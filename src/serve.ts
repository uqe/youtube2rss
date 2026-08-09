import { extname, isAbsolute, join, normalize, relative, resolve } from "node:path";

import { createAdminHandler } from "./admin-handler.ts";
import { getLogLevel, getPort, loadServerAppConfig } from "./config.ts";
import { createDb } from "./db.ts";
import { logger } from "./logger.ts";
import { registerShutdownHandlers } from "./shutdown.ts";

const BASE_PATH = resolve("./public");

interface ServerLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

interface StaticFileHandlerOptions {
  basePath?: string;
  logLevel?: string;
  log?: ServerLogger;
}

interface CreateServerOptions extends StaticFileHandlerOptions {
  port?: number;
  handler?: (req: Request) => Promise<Response>;
}

interface ApplicationHandlerOptions extends StaticFileHandlerOptions {
  staticHandler?: (req: Request) => Promise<Response>;
  adminHandler?: (req: Request) => Promise<Response>;
}

interface StartServerOptions extends CreateServerOptions {
  initializeDatabase?: () => Promise<void>;
}

export const mimeTypes: { [key: string]: string } = {
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".xml": "application/xml",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json+chapters",
};

export const getOptimalCacheControl = (contentType: string): string => {
  if (contentType === "audio/mpeg") {
    return "public, max-age=2592000"; // 30 days for audio files
  }
  if (contentType === "application/xml") {
    return "public, max-age=300"; // Keep HTTP caching aligned with the RSS TTL.
  }
  if (contentType === "application/json+chapters") {
    return "public, max-age=300";
  }
  if (contentType.startsWith("image/")) {
    return "public, max-age=604800"; // 7 days for images
  }
  if (contentType === "text/css" || contentType === "text/javascript") {
    return "public, max-age=300";
  }
  return "public, max-age=3600"; // 1 hour for other content
};

export const getContentType = (filePath: string) =>
  mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream";

export const createEtag = ({ size, mtime }: { size: number; mtime?: Date | null }) => {
  return `W/"${size.toString(16)}-${mtime?.getTime().toString(16)}"`;
};

export const parseRangeHeader = (rangeHeader: string, fileSize: number): [number, number] | null => {
  if (fileSize <= 0) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }

  if (!match[1] && !match[2]) {
    return null;
  }

  if (!match[1]) {
    const suffixLength = Number.parseInt(match[2], 10);
    if (Number.isNaN(suffixLength) || suffixLength <= 0) {
      return null;
    }
    return [Math.max(fileSize - suffixLength, 0), fileSize - 1];
  }

  const start = Number.parseInt(match[1], 10);
  const requestedEnd = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1;
  const end = Math.min(requestedEnd, fileSize - 1);

  if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize || start > end) {
    return null;
  }

  return [start, end];
};

export const resolveSafePath = (pathname: string, basePath = BASE_PATH) => {
  const normalizedPathname = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(normalizedPathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = resolve(join(basePath, safePath));
  const relativePath = relative(basePath, filePath);
  const isInsideBasePath = relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));

  return {
    pathname: normalizedPathname,
    safePath,
    filePath,
    isInsideBasePath,
  };
};

export const createStaticFileHandler = ({
  basePath = BASE_PATH,
  logLevel = getLogLevel(),
  log = logger,
}: StaticFileHandlerOptions = {}) => {
  return async (req: Request) => {
    const url = new URL(req.url);
    const { pathname, safePath, filePath, isInsideBasePath } = resolveSafePath(url.pathname, basePath);

    if (!isInsideBasePath) {
      if (logLevel !== "error") {
        log.warn(`[403] Attempted path traversal: ${pathname}`);
      }
      return new Response("Forbidden", { status: 403 });
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    try {
      const file = Bun.file(filePath);
      const exists = await file.exists();

      if (!exists) {
        if (logLevel !== "error") {
          log.warn(`[404] Not found: ${safePath}`);
        }
        return new Response("File not found", { status: 404 });
      }

      const contentType = getContentType(filePath);

      const stat = await file.stat();
      const etag = createEtag(stat);

      const ifNoneMatch = req.headers.get("If-None-Match");
      if (ifNoneMatch === etag) {
        return new Response(null, { status: 304 });
      }

      const headers = new Headers({
        "Content-Type": contentType,
        ETag: etag,
        Server: "Bun",
        "Created-By": "https://github.com/uqe/youtube2rss",
        "Cache-Control": getOptimalCacheControl(contentType),
        "Access-Control-Allow-Origin": "*",
        "Content-Length": `${stat.size}`,
      });

      if (contentType === "audio/mpeg") {
        headers.set("Accept-Ranges", "bytes");
      }

      const rangeHeader = req.headers.get("Range");
      if (rangeHeader && contentType === "audio/mpeg") {
        const fileSize = stat.size;
        const ranges = parseRangeHeader(rangeHeader, fileSize);

        if (ranges) {
          const [start, end] = ranges;
          headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
          headers.set("Content-Length", `${end - start + 1}`);

          if (logLevel === "debug") {
            log.debug(`[206] Serving ${safePath} (${contentType}) Range: ${start}-${end}/${fileSize}`);
          }

          return new Response(req.method === "HEAD" ? null : file.slice(start, end + 1), {
            status: 206,
            headers,
          });
        }

        headers.set("Content-Range", `bytes */${fileSize}`);
        headers.set("Content-Length", "0");
        return new Response(null, { status: 416, headers });
      }

      if (logLevel !== "error") {
        log.info(`[200] Serving ${safePath} (${contentType})`);
      }

      if (req.method === "HEAD") {
        return new Response(null, { headers });
      }

      return new Response(file, { headers });
    } catch (e) {
      log.error(`Error serving ${pathname}`);
      console.error(e);
      return new Response("Server error", { status: 500 });
    }
  };
};

export const serverHandler = createStaticFileHandler();

export const createApplicationHandler = ({
  basePath = BASE_PATH,
  logLevel = getLogLevel(),
  log = logger,
  staticHandler = createStaticFileHandler({ basePath, logLevel, log }),
  adminHandler = createAdminHandler(),
}: ApplicationHandlerOptions = {}) => {
  return (request: Request) => {
    const { pathname } = new URL(request.url);
    return pathname === "/admin" || pathname === "/admin.html" || pathname.startsWith("/api/admin/")
      ? adminHandler(request)
      : staticHandler(request);
  };
};

export const createServer = ({
  port = getPort(),
  basePath = BASE_PATH,
  logLevel = getLogLevel(),
  log = logger,
  handler = createApplicationHandler({ basePath, logLevel, log }),
}: CreateServerOptions = {}) =>
  Bun.serve({
    port,
    idleTimeout: 30,
    async fetch(req) {
      return handler(req);
    },
    error(error) {
      log.error("Server error");
      console.error(error);
      return new Response("Server error occurred", { status: 500 });
    },
  });

export const startServer = async ({
  port,
  basePath = BASE_PATH,
  log = logger,
  logLevel,
  initializeDatabase = createDb,
  ...options
}: StartServerOptions = {}) => {
  await initializeDatabase();
  const config = loadServerAppConfig();
  const actualPort = port ?? config.port;
  const actualLogLevel = logLevel ?? config.logLevel;
  const server = createServer({
    ...options,
    port: actualPort,
    basePath,
    log,
    logLevel: actualLogLevel,
  });
  registerShutdownHandlers({
    async shutdown(signal) {
      log.info(`Received ${signal}; stopping static file server`);
      await server.stop();
    },
  });
  log.info(`Static file server running at http://localhost:${actualPort}`);
  log.info(`Serving files from: ${basePath}`);
  return server;
};

if (import.meta.main) {
  await startServer();
}
