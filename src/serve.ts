import { getLogLevel, getPort } from "./config.ts";
import { logger } from "./logger.ts";
import { extname, isAbsolute, join, normalize, relative, resolve } from "node:path";

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

export const mimeTypes: { [key: string]: string } = {
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".xml": "application/xml",
  ".html": "text/html",
};

export const getOptimalCacheControl = (contentType: string): string => {
  if (contentType === "audio/mpeg") {
    return "public, max-age=2592000"; // 30 days for audio files
  }
  if (contentType === "application/xml") {
    return "public, max-age=900"; // 15 minutes for XML (feed files)
  }
  if (contentType.startsWith("image/")) {
    return "public, max-age=604800"; // 7 days for images
  }
  return "public, max-age=3600"; // 1 hour for other content
};

export const getContentType = (filePath: string) =>
  mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream";

export const createEtag = ({ size, mtime }: { size: number; mtime?: Date | null }) => {
  return `W/"${size.toString(16)}-${mtime?.getTime().toString(16)}"`;
};

export const parseRangeHeader = (rangeHeader: string, fileSize: number): [number, number] | null => {
  const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
  if (!match) return null;

  const start = Number.parseInt(match[1], 10);
  const end = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
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
      if (logLevel !== "error") log.warn(`[403] Attempted path traversal: ${pathname}`);
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
        if (logLevel !== "error") log.warn(`[404] Not found: ${safePath}`);
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
      });

      const rangeHeader = req.headers.get("Range");
      if (rangeHeader && contentType === "audio/mpeg") {
        const fileSize = stat.size;
        const ranges = parseRangeHeader(rangeHeader, fileSize);

        if (ranges) {
          const [start, end] = ranges;
          headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
          headers.set("Content-Length", `${end - start + 1}`);
          headers.set("Accept-Ranges", "bytes");

          if (logLevel === "debug") {
            log.debug(`[206] Serving ${safePath} (${contentType}) Range: ${start}-${end}/${fileSize}`);
          }

          return new Response(file.slice(start, end + 1), {
            status: 206,
            headers,
          });
        }
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

export const createServer = ({
  port = getPort(),
  basePath = BASE_PATH,
  logLevel = getLogLevel(),
  log = logger,
  handler = createStaticFileHandler({ basePath, logLevel, log }),
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

export const startServer = ({
  port = getPort(),
  basePath = BASE_PATH,
  log = logger,
  ...options
}: CreateServerOptions = {}) => {
  const server = createServer({ ...options, port, basePath, log });
  log.info(`Static file server running at http://localhost:${port}`);
  log.info(`Serving files from: ${basePath}`);
  return server;
};

if (import.meta.main) {
  startServer();
}
