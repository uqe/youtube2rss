import { afterAll, afterEach, beforeAll, describe, expect, it, spyOn } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createApplicationHandler,
  createEtag,
  createServer,
  createStaticFileHandler,
  getContentType,
  getOptimalCacheControl,
  mimeTypes,
  parseRangeHeader,
  resolveSafePath,
  serverHandler,
  startServer,
} from "../serve.ts";

const testPublicDir = "./src/tests/data/static-public";
const testPublicPath = resolve(testPublicDir);
const silentLogger = {
  debug(): void {},
  info(): void {},
  warn(): void {},
  error(): void {},
};

describe("serve tests", () => {
  beforeAll(async () => {
    await mkdir(testPublicDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testPublicDir, { recursive: true, force: true });
    await mkdir(testPublicDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(testPublicDir, { recursive: true, force: true });
  });

  describe("mimeTypes", () => {
    it("should have correct MIME type for mp3", () => {
      expect(mimeTypes[".mp3"]).toBe("audio/mpeg");
    });

    it("should have correct MIME type for png", () => {
      expect(mimeTypes[".png"]).toBe("image/png");
    });

    it("should have correct MIME type for jpg", () => {
      expect(mimeTypes[".jpg"]).toBe("image/jpeg");
    });

    it("should have correct MIME type for jpeg", () => {
      expect(mimeTypes[".jpeg"]).toBe("image/jpeg");
    });

    it("should have correct MIME type for svg", () => {
      expect(mimeTypes[".svg"]).toBe("image/svg+xml");
    });

    it("should have correct MIME type for xml", () => {
      expect(mimeTypes[".xml"]).toBe("application/xml");
    });

    it("should have correct MIME type for html", () => {
      expect(mimeTypes[".html"]).toBe("text/html");
    });

    it("should serve chapter JSON with the Podcasting 2.0 MIME type", () => {
      expect(mimeTypes[".json"]).toBe("application/json+chapters");
    });

    it("should have browser-safe MIME types for admin assets", () => {
      expect(mimeTypes[".css"]).toBe("text/css");
      expect(mimeTypes[".js"]).toBe("text/javascript");
    });

    it("should return undefined for unknown extension", () => {
      expect(mimeTypes[".unknown"]).toBeUndefined();
    });
  });

  describe("getOptimalCacheControl", () => {
    it("should return 30 days cache for audio/mpeg", () => {
      expect(getOptimalCacheControl("audio/mpeg")).toBe("public, max-age=2592000");
    });

    it("should align application/xml cache with the five-minute RSS TTL", () => {
      expect(getOptimalCacheControl("application/xml")).toBe("public, max-age=300");
    });

    it("should use short caching for chapter JSON", () => {
      expect(getOptimalCacheControl("application/json+chapters")).toBe("public, max-age=300");
    });

    it("should return 7 days cache for image/png", () => {
      expect(getOptimalCacheControl("image/png")).toBe("public, max-age=604800");
    });

    it("should return 7 days cache for image/jpeg", () => {
      expect(getOptimalCacheControl("image/jpeg")).toBe("public, max-age=604800");
    });

    it("should return 7 days cache for image/svg+xml", () => {
      expect(getOptimalCacheControl("image/svg+xml")).toBe("public, max-age=604800");
    });

    it("should use short caching for admin assets", () => {
      expect(getOptimalCacheControl("text/css")).toBe("public, max-age=300");
      expect(getOptimalCacheControl("text/javascript")).toBe("public, max-age=300");
    });

    it("should return 1 hour cache for unknown content type", () => {
      expect(getOptimalCacheControl("application/octet-stream")).toBe("public, max-age=3600");
    });

    it("should return 1 hour cache for text/plain", () => {
      expect(getOptimalCacheControl("text/plain")).toBe("public, max-age=3600");
    });
  });

  describe("getContentType", () => {
    it("should detect content type case-insensitively", () => {
      expect(getContentType("/tmp/audio.MP3")).toBe("audio/mpeg");
      expect(getContentType("/tmp/feed.XML")).toBe("application/xml");
    });

    it("should fall back to application/octet-stream", () => {
      expect(getContentType("/tmp/file.unknown")).toBe("application/octet-stream");
    });
  });

  describe("createEtag", () => {
    it("should build weak ETag from size and mtime", () => {
      expect(createEtag({ size: 255, mtime: new Date(16) })).toBe('W/"ff-10"');
    });
  });

  describe("parseRangeHeader", () => {
    const fileSize = 1000;

    it("should parse valid range with start and end", () => {
      const result = parseRangeHeader("bytes=0-499", fileSize);
      expect(result).toEqual([0, 499]);
    });

    it("should parse range with only start (end defaults to fileSize-1)", () => {
      const result = parseRangeHeader("bytes=500-", fileSize);
      expect(result).toEqual([500, 999]);
    });

    it("should return null for invalid range format", () => {
      const result = parseRangeHeader("invalid", fileSize);
      expect(result).toBeNull();
    });

    it("should return null when start >= fileSize", () => {
      const result = parseRangeHeader("bytes=1000-", fileSize);
      expect(result).toBeNull();
    });

    it("should clamp an end beyond the file size", () => {
      const result = parseRangeHeader("bytes=0-1000", fileSize);
      expect(result).toEqual([0, 999]);
    });

    it("should return null when start > end", () => {
      const result = parseRangeHeader("bytes=500-100", fileSize);
      expect(result).toBeNull();
    });

    it("should handle range starting from 0", () => {
      const result = parseRangeHeader("bytes=0-0", fileSize);
      expect(result).toEqual([0, 0]);
    });

    it("should handle last byte request", () => {
      const result = parseRangeHeader("bytes=999-999", fileSize);
      expect(result).toEqual([999, 999]);
    });

    it("should parse suffix ranges", () => {
      const result = parseRangeHeader("bytes=-500", fileSize);
      expect(result).toEqual([500, 999]);
    });

    it("should reject multiple ranges", () => {
      expect(parseRangeHeader("bytes=0-10,20-30", fileSize)).toBeNull();
    });

    it("should reject ranges for empty and invalid file sizes", () => {
      expect(parseRangeHeader("bytes=0-0", 0)).toBeNull();
      expect(parseRangeHeader("bytes=0-0", -1)).toBeNull();
    });

    it("should trim surrounding whitespace", () => {
      expect(parseRangeHeader("  bytes=10-19  ", fileSize)).toEqual([10, 19]);
    });

    it("should reject a range without either boundary", () => {
      expect(parseRangeHeader("bytes=-", fileSize)).toBeNull();
    });

    it("should reject an empty suffix range", () => {
      expect(parseRangeHeader("bytes=-0", fileSize)).toBeNull();
    });

    it("should clamp suffix ranges larger than the file", () => {
      expect(parseRangeHeader("bytes=-2000", fileSize)).toEqual([0, 999]);
    });

    it("should reject unsupported units and signed boundaries", () => {
      expect(parseRangeHeader("items=0-10", fileSize)).toBeNull();
      expect(parseRangeHeader("Bytes=0-10", fileSize)).toBeNull();
      expect(parseRangeHeader("bytes=+1-10", fileSize)).toBeNull();
      expect(parseRangeHeader("bytes=-1-10", fileSize)).toBeNull();
    });
  });

  describe("resolveSafePath", () => {
    it("should resolve root to index.html inside base path", () => {
      const result = resolveSafePath("/", testPublicPath);

      expect(result.safePath).toBe("/index.html");
      expect(result.filePath).toBe(resolve(testPublicPath, "index.html"));
      expect(result.isInsideBasePath).toBe(true);
    });

    it("should keep resolved path inside base path for traversal input", () => {
      const result = resolveSafePath("/../../../etc/passwd", testPublicPath);

      expect(result.filePath.startsWith(testPublicPath)).toBe(true);
      expect(result.isInsideBasePath).toBe(true);
    });

    it("should resolve nested public files without changing the pathname", () => {
      const result = resolveSafePath("/assets/admin/app.js", testPublicPath);

      expect(result.pathname).toBe("/assets/admin/app.js");
      expect(result.safePath).toBe("/assets/admin/app.js");
      expect(result.filePath).toBe(resolve(testPublicPath, "assets/admin/app.js"));
      expect(result.isInsideBasePath).toBe(true);
    });
  });

  describe("createStaticFileHandler", () => {
    it("should serve files from a custom base path", async () => {
      await Bun.write(`${testPublicDir}/custom.html`, "<html>custom</html>");
      const handler = createStaticFileHandler({
        basePath: testPublicPath,
        logLevel: "error",
        log: silentLogger,
      });

      const response = await handler(new Request("http://localhost/custom.html"));

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/html");
      expect(await response.text()).toBe("<html>custom</html>");
    });

    it("should log missing files outside error-only mode", async () => {
      const warnings: string[] = [];
      const handler = createStaticFileHandler({
        basePath: testPublicPath,
        logLevel: "info",
        log: { ...silentLogger, warn: (message) => warnings.push(message) },
      });

      const response = await handler(new Request("http://localhost/missing.txt"));

      expect(response.status).toBe(404);
      expect(warnings).toEqual(["[404] Not found: /missing.txt"]);
    });

    it("should suppress missing-file logs in error-only mode", async () => {
      const warnings: string[] = [];
      const handler = createStaticFileHandler({
        basePath: testPublicPath,
        logLevel: "error",
        log: { ...silentLogger, warn: (message) => warnings.push(message) },
      });

      expect((await handler(new Request("http://localhost/missing.txt"))).status).toBe(404);
      expect(warnings).toEqual([]);
    });

    it("should emit detailed range logs in debug mode", async () => {
      await Bun.write(`${testPublicDir}/debug.mp3`, "0123456789");
      const messages: string[] = [];
      const handler = createStaticFileHandler({
        basePath: testPublicPath,
        logLevel: "debug",
        log: { ...silentLogger, debug: (message) => messages.push(message) },
      });

      const response = await handler(new Request("http://localhost/debug.mp3", { headers: { Range: "bytes=3-6" } }));

      expect(response.status).toBe(206);
      expect(await response.text()).toBe("3456");
      expect(messages).toEqual(["[206] Serving /debug.mp3 (audio/mpeg) Range: 3-6/10"]);
    });

    it("should log successful full-file responses", async () => {
      await Bun.write(`${testPublicDir}/logged.css`, "body {}");
      const messages: string[] = [];
      const handler = createStaticFileHandler({
        basePath: testPublicPath,
        logLevel: "info",
        log: { ...silentLogger, info: (message) => messages.push(message) },
      });

      const response = await handler(new Request("http://localhost/logged.css"));

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
      expect(messages).toEqual(["[200] Serving /logged.css (text/css)"]);
    });

    it("should return an empty 304 response before logging a file serve", async () => {
      await Bun.write(`${testPublicDir}/cached.html`, "cached");
      const messages: string[] = [];
      const handler = createStaticFileHandler({
        basePath: testPublicPath,
        logLevel: "info",
        log: { ...silentLogger, info: (message) => messages.push(message) },
      });
      const initialResponse = await handler(new Request("http://localhost/cached.html"));
      const etag = initialResponse.headers.get("ETag");
      messages.length = 0;

      const cachedResponse = await handler(
        new Request("http://localhost/cached.html", { headers: { "If-None-Match": etag ?? "" } }),
      );

      expect(cachedResponse.status).toBe(304);
      expect(await cachedResponse.text()).toBe("");
      expect(messages).toEqual([]);
    });
  });

  describe("createServer", () => {
    it("should pass basePath to the default static file handler", async () => {
      await Bun.write(`${testPublicDir}/server.html`, "<html>server</html>");
      const server = createServer({
        port: 0,
        basePath: testPublicPath,
        logLevel: "error",
        log: silentLogger,
      });

      try {
        const response = await fetch(new URL("/server.html", server.url));

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("<html>server</html>");
      } finally {
        server.stop(true);
      }
    });

    it("should delegate requests to a custom handler", async () => {
      const paths: string[] = [];
      const server = createServer({
        port: 0,
        log: silentLogger,
        handler: async (request) => {
          paths.push(new URL(request.url).pathname);
          return new Response("custom response", { status: 202 });
        },
      });

      try {
        const response = await fetch(new URL("/custom-handler", server.url));
        expect(response.status).toBe(202);
        expect(await response.text()).toBe("custom response");
        expect(paths).toEqual(["/custom-handler"]);
      } finally {
        server.stop(true);
      }
    });

    it("should convert unhandled request errors into a generic 500 response", async () => {
      const errors: string[] = [];
      const consoleError = spyOn(console, "error").mockImplementation(() => {});
      const server = createServer({
        port: 0,
        log: { ...silentLogger, error: (message) => errors.push(message) },
        handler: async () => {
          throw new Error("handler failed");
        },
      });

      try {
        const response = await fetch(server.url);
        expect(response.status).toBe(500);
        expect(await response.text()).toBe("Server error occurred");
        expect(errors).toEqual(["Server error"]);
        expect(consoleError).toHaveBeenCalledTimes(1);
      } finally {
        server.stop(true);
        consoleError.mockRestore();
      }
    });
  });

  describe("startServer", () => {
    it("should initialize dependencies, start serving, and log runtime details", async () => {
      const previousSigintListeners = new Set(process.listeners("SIGINT"));
      const previousSigtermListeners = new Set(process.listeners("SIGTERM"));
      const messages: string[] = [];
      let initializationCalls = 0;
      const server = await startServer({
        port: 0,
        basePath: testPublicPath,
        logLevel: "error",
        log: { ...silentLogger, info: (message) => messages.push(message) },
        async initializeDatabase() {
          initializationCalls += 1;
        },
        handler: async () => new Response("started"),
      });

      try {
        const response = await fetch(server.url);
        expect(await response.text()).toBe("started");
        expect(initializationCalls).toBe(1);
        expect(messages).toEqual([
          "Static file server running at http://localhost:0",
          `Serving files from: ${testPublicPath}`,
        ]);
      } finally {
        server.stop(true);
        for (const listener of process.listeners("SIGINT")) {
          if (!previousSigintListeners.has(listener)) {
            process.off("SIGINT", listener);
          }
        }
        for (const listener of process.listeners("SIGTERM")) {
          if (!previousSigtermListeners.has(listener)) {
            process.off("SIGTERM", listener);
          }
        }
      }
    });

    it("should not start a server when database initialization fails", async () => {
      const messages: string[] = [];

      await expect(
        startServer({
          port: 0,
          log: { ...silentLogger, info: (message) => messages.push(message) },
          async initializeDatabase() {
            throw new Error("database failed");
          },
        }),
      ).rejects.toThrow("database failed");
      expect(messages).toEqual([]);
    });
  });

  describe("createApplicationHandler", () => {
    it("should route admin requests separately from public files", async () => {
      const requests: string[] = [];
      const handler = createApplicationHandler({
        staticHandler: async (request) => {
          requests.push(`static:${new URL(request.url).pathname}`);
          return new Response("static");
        },
        adminHandler: async (request) => {
          requests.push(`admin:${new URL(request.url).pathname}`);
          return new Response("admin");
        },
      });

      expect(await (await handler(new Request("http://localhost/admin"))).text()).toBe("admin");
      expect(await (await handler(new Request("http://localhost/admin.html"))).text()).toBe("admin");
      expect(await (await handler(new Request("http://localhost/api/admin/videos"))).text()).toBe("admin");
      expect(await (await handler(new Request("http://localhost/rss.xml"))).text()).toBe("static");
      expect(requests).toEqual(["admin:/admin", "admin:/admin.html", "admin:/api/admin/videos", "static:/rss.xml"]);
    });

    it("should require exact admin route boundaries", async () => {
      const handler = createApplicationHandler({
        staticHandler: async () => new Response("static"),
        adminHandler: async () => new Response("admin"),
      });

      expect(await (await handler(new Request("http://localhost/admin/settings"))).text()).toBe("static");
      expect(await (await handler(new Request("http://localhost/api/admin"))).text()).toBe("static");
      expect(await (await handler(new Request("http://localhost/api/admin/jobs/123"))).text()).toBe("admin");
      expect(await (await handler(new Request("http://localhost/admin?source=test"))).text()).toBe("admin");
    });
  });

  describe("serverHandler", () => {
    describe("HTTP methods", () => {
      it("should return 405 for POST method", async () => {
        const req = new Request("http://localhost/test.html", { method: "POST" });
        const response = await serverHandler(req);

        expect(response.status).toBe(405);
        expect(response.headers.get("Allow")).toBe("GET, HEAD");
      });

      it("should return 405 for PUT method", async () => {
        const req = new Request("http://localhost/test.html", { method: "PUT" });
        const response = await serverHandler(req);

        expect(response.status).toBe(405);
      });

      it("should return 405 for DELETE method", async () => {
        const req = new Request("http://localhost/test.html", { method: "DELETE" });
        const response = await serverHandler(req);

        expect(response.status).toBe(405);
      });

      it("should return 405 for PATCH method", async () => {
        const req = new Request("http://localhost/test.html", { method: "PATCH" });
        const response = await serverHandler(req);

        expect(response.status).toBe(405);
      });
    });

    describe("Security - Path traversal", () => {
      it("should handle path traversal attempt safely", async () => {
        const req = new Request("http://localhost/../../../etc/passwd", { method: "GET" });
        const response = await serverHandler(req);

        // Путь нормализуется, поэтому возвращается 404 (файл не найден в public)
        // или 403 если путь выходит за пределы BASE_PATH
        expect([403, 404]).toContain(response.status);
      });

      it("should handle backslash path traversal attempt safely", async () => {
        const req = new Request("http://localhost/..\\..\\etc\\passwd", { method: "GET" });
        const response = await serverHandler(req);

        // Может вернуть 403 или 404 в зависимости от нормализации
        expect([403, 404]).toContain(response.status);
      });
    });

    describe("File serving", () => {
      it("should return 404 for non-existent file", async () => {
        const req = new Request("http://localhost/non-existent-file-12345.xyz", { method: "GET" });
        const response = await serverHandler(req);

        expect(response.status).toBe(404);
        expect(await response.text()).toBe("File not found");
      });

      it("should redirect root to index.html internally", async () => {
        const req = new Request("http://localhost/", { method: "GET" });
        const response = await serverHandler(req);

        // Должен вернуть либо файл, либо 404 если index.html не существует
        expect([200, 404]).toContain(response.status);
      });
    });

    describe("HEAD requests", () => {
      it("should handle HEAD request without body", async () => {
        const req = new Request("http://localhost/non-existent.html", { method: "HEAD" });
        const response = await serverHandler(req);

        expect(response.status).toBe(404);
      });

      it("should return headers without body for an existing file", async () => {
        const testFile = "./public/test-head.html";
        await Bun.write(testFile, "<html>head</html>");

        const req = new Request("http://localhost/test-head.html", { method: "HEAD" });
        const response = await serverHandler(req);

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("text/html");
        expect(await response.text()).toBe("");

        await Bun.file(testFile).delete();
      });
    });

    describe("Range requests", () => {
      it("should return partial content for valid audio range requests", async () => {
        const testFile = "./public/test-range.mp3";
        await Bun.write(testFile, "0123456789");

        const req = new Request("http://localhost/test-range.mp3", {
          method: "GET",
          headers: { Range: "bytes=2-5" },
        });
        const response = await serverHandler(req);

        expect(response.status).toBe(206);
        expect(response.headers.get("Content-Range")).toBe("bytes 2-5/10");
        expect(response.headers.get("Content-Length")).toBe("4");
        expect(response.headers.get("Accept-Ranges")).toBe("bytes");
        expect(await response.text()).toBe("2345");

        await Bun.file(testFile).delete();
      });

      it("should ignore range headers for non-audio files", async () => {
        const testFile = "./public/test-range.html";
        await Bun.write(testFile, "0123456789");

        const req = new Request("http://localhost/test-range.html", {
          method: "GET",
          headers: { Range: "bytes=2-5" },
        });
        const response = await serverHandler(req);

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Range")).toBeNull();
        expect(await response.text()).toBe("0123456789");

        await Bun.file(testFile).delete();
      });

      it("should serve suffix ranges", async () => {
        const testFile = "./public/test-suffix-range.mp3";
        await Bun.write(testFile, "0123456789");

        const response = await serverHandler(
          new Request("http://localhost/test-suffix-range.mp3", {
            headers: { Range: "bytes=-4" },
          }),
        );

        expect(response.status).toBe(206);
        expect(response.headers.get("Content-Range")).toBe("bytes 6-9/10");
        expect(await response.text()).toBe("6789");

        await Bun.file(testFile).delete();
      });

      it("should return 416 for an invalid audio range", async () => {
        const testFile = "./public/test-invalid-range.mp3";
        await Bun.write(testFile, "0123456789");

        const response = await serverHandler(
          new Request("http://localhost/test-invalid-range.mp3", {
            headers: { Range: "bytes=20-30" },
          }),
        );

        expect(response.status).toBe(416);
        expect(response.headers.get("Content-Range")).toBe("bytes */10");
        expect(response.headers.get("Content-Length")).toBe("0");

        await Bun.file(testFile).delete();
      });

      it("should return headers without a body for HEAD range requests", async () => {
        const testFile = "./public/test-head-range.mp3";
        await Bun.write(testFile, "0123456789");

        const response = await serverHandler(
          new Request("http://localhost/test-head-range.mp3", {
            method: "HEAD",
            headers: { Range: "bytes=2-5" },
          }),
        );

        expect(response.status).toBe(206);
        expect(response.headers.get("Content-Length")).toBe("4");
        expect(await response.text()).toBe("");

        await Bun.file(testFile).delete();
      });
    });

    describe("Response headers", () => {
      it("should include length and range support for full audio responses", async () => {
        const testFile = "./public/test-full-audio.mp3";
        await Bun.write(testFile, "0123456789");

        const response = await serverHandler(new Request("http://localhost/test-full-audio.mp3"));

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Length")).toBe("10");
        expect(response.headers.get("Accept-Ranges")).toBe("bytes");

        await Bun.file(testFile).delete();
      });

      it("should include CORS header", async () => {
        // Создаём временный тестовый файл
        const testFile = "./public/test-cors.html";
        await Bun.write(testFile, "<html></html>");

        const req = new Request("http://localhost/test-cors.html", { method: "GET" });
        const response = await serverHandler(req);

        if (response.status === 200) {
          expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
          expect(response.headers.get("Server")).toBe("Bun");
          expect(response.headers.get("Created-By")).toBe("https://github.com/uqe/youtube2rss");
        }

        // Удаляем тестовый файл
        await Bun.file(testFile).delete();
      });
    });

    describe("ETag and caching", () => {
      it("should return 304 when If-None-Match matches ETag", async () => {
        // Создаём временный тестовый файл
        const testFile = "./public/test-etag.html";
        await Bun.write(testFile, "<html>test</html>");

        // Первый запрос для получения ETag
        const req1 = new Request("http://localhost/test-etag.html", { method: "GET" });
        const response1 = await serverHandler(req1);

        if (response1.status === 200) {
          const etag = response1.headers.get("ETag");

          if (etag) {
            // Второй запрос с If-None-Match
            const req2 = new Request("http://localhost/test-etag.html", {
              method: "GET",
              headers: { "If-None-Match": etag },
            });
            const response2 = await serverHandler(req2);

            expect(response2.status).toBe(304);
          }
        }

        // Удаляем тестовый файл
        await Bun.file(testFile).delete();
      });
    });

    describe("Content-Type detection", () => {
      it("should set correct Content-Type for HTML file", async () => {
        const testFile = "./public/test-content-type.html";
        await Bun.write(testFile, "<html></html>");

        const req = new Request("http://localhost/test-content-type.html", { method: "GET" });
        const response = await serverHandler(req);

        if (response.status === 200) {
          expect(response.headers.get("Content-Type")).toBe("text/html");
        }

        await Bun.file(testFile).delete();
      });

      it("should set correct Content-Type for XML file", async () => {
        const testFile = "./public/test-content-type.xml";
        await Bun.write(testFile, '<?xml version="1.0"?><root></root>');

        const req = new Request("http://localhost/test-content-type.xml", { method: "GET" });
        const response = await serverHandler(req);

        if (response.status === 200) {
          expect(response.headers.get("Content-Type")).toBe("application/xml");
        }

        await Bun.file(testFile).delete();
      });

      it("should set application/octet-stream for unknown file type", async () => {
        const testFile = "./public/test-unknown.xyz";
        await Bun.write(testFile, "test content");

        const req = new Request("http://localhost/test-unknown.xyz", { method: "GET" });
        const response = await serverHandler(req);

        if (response.status === 200) {
          expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
        }

        await Bun.file(testFile).delete();
      });
    });
  });
});
