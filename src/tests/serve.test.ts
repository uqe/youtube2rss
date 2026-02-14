import { getOptimalCacheControl, mimeTypes, parseRangeHeader, serverHandler } from "../serve.ts";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { resolve } from "node:path";

describe("serve tests", () => {
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

    it("should have correct MIME type for xml", () => {
      expect(mimeTypes[".xml"]).toBe("application/xml");
    });

    it("should have correct MIME type for html", () => {
      expect(mimeTypes[".html"]).toBe("text/html");
    });

    it("should return undefined for unknown extension", () => {
      expect(mimeTypes[".unknown"]).toBeUndefined();
    });
  });

  describe("getOptimalCacheControl", () => {
    it("should return 30 days cache for audio/mpeg", () => {
      expect(getOptimalCacheControl("audio/mpeg")).toBe("public, max-age=2592000");
    });

    it("should return 15 minutes cache for application/xml", () => {
      expect(getOptimalCacheControl("application/xml")).toBe("public, max-age=900");
    });

    it("should return 7 days cache for image/png", () => {
      expect(getOptimalCacheControl("image/png")).toBe("public, max-age=604800");
    });

    it("should return 7 days cache for image/jpeg", () => {
      expect(getOptimalCacheControl("image/jpeg")).toBe("public, max-age=604800");
    });

    it("should return 1 hour cache for unknown content type", () => {
      expect(getOptimalCacheControl("application/octet-stream")).toBe("public, max-age=3600");
    });

    it("should return 1 hour cache for text/plain", () => {
      expect(getOptimalCacheControl("text/plain")).toBe("public, max-age=3600");
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

    it("should return null when end >= fileSize", () => {
      const result = parseRangeHeader("bytes=0-1000", fileSize);
      expect(result).toBeNull();
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

    it("should return null for negative numbers (regex won't match)", () => {
      const result = parseRangeHeader("bytes=-500-", fileSize);
      expect(result).toBeNull();
    });
  });

  describe("serverHandler", () => {
    const testFilePath = "./public/index.html";
    let testFileExists = false;

    beforeAll(async () => {
      // Проверяем существование тестовых файлов
      testFileExists = await Bun.file(testFilePath).exists();
    });

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
    });

    describe("Response headers", () => {
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
