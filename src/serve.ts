import { join, normalize, resolve } from "node:path";
import { getLogLevel, getPort } from "./config.ts";
import { logger } from "./logger.ts";

const BASE_PATH = resolve("./public");
const PORT = getPort();
const LOG_LEVEL = getLogLevel(); // "debug", "info", "error"

const mimeTypes: { [key: string]: string } = {
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".xml": "application/xml",
  ".html": "text/html",
};

const getOptimalCacheControl = (contentType: string): string => {
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

const parseRangeHeader = (rangeHeader: string, fileSize: number): [number, number] | null => {
  const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
  if (!match) return null;

  const start = Number.parseInt(match[1], 10);
  const end = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
    return null;
  }

  return [start, end];
};

export const serverHandler = async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;

  // Security: Prevent path traversal attacks
  const safePath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = resolve(join(BASE_PATH, safePath));

  // Security: Ensure the path is within BASE_PATH
  if (!filePath.startsWith(BASE_PATH)) {
    if (LOG_LEVEL !== "error") logger.warn(`[403] Attempted path traversal: ${pathname}`);
    return new Response("Forbidden", { status: 403 });
  }

  // Only allow GET and HEAD methods for static files
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
      if (LOG_LEVEL !== "error") logger.warn(`[404] Not found: ${safePath}`);
      return new Response("File not found", { status: 404 });
    }

    const extension = filePath.split(".").pop() || "";
    const contentType = mimeTypes[`.${extension}`] || "application/octet-stream";

    // Generate ETag for caching (using last modified and size)
    const stat = await file.stat();
    const etag = `W/"${stat.size.toString(16)}-${stat.mtime?.getTime().toString(16)}"`;

    // Check if client has current version
    const ifNoneMatch = req.headers.get("If-None-Match");
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304 });
    }

    // Set appropriate headers
    const headers = new Headers({
      "Content-Type": contentType,
      ETag: etag,
      Server: "Bun",
      "Created-By": "https://github.com/uqe/youtube2rss",
      "Cache-Control": getOptimalCacheControl(contentType),
      "Access-Control-Allow-Origin": "*", // CORS
    });

    // Support range requests for audio files
    const rangeHeader = req.headers.get("Range");
    if (rangeHeader && contentType === "audio/mpeg") {
      const fileSize = stat.size;
      const ranges = parseRangeHeader(rangeHeader, fileSize);

      if (ranges) {
        const [start, end] = ranges;
        headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
        headers.set("Content-Length", `${end - start + 1}`);
        headers.set("Accept-Ranges", "bytes");

        if (LOG_LEVEL === "debug") {
          logger.debug(`[206] Serving ${safePath} (${contentType}) Range: ${start}-${end}/${fileSize}`);
        }

        return new Response(file.slice(start, end + 1), {
          status: 206,
          headers,
        });
      }
    }

    // Only log successful responses based on log level
    if (LOG_LEVEL !== "error") {
      logger.info(`[200] Serving ${safePath} (${contentType})`);
    }

    // Don't return body for HEAD requests
    if (req.method === "HEAD") {
      return new Response(null, { headers });
    }

    return new Response(file, { headers });
  } catch (e) {
    logger.error(`Error serving ${pathname}`);
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
};

const server = () =>
  Bun.serve({
    port: PORT,
    idleTimeout: 30,
    async fetch(req) {
      return serverHandler(req);
    },
    error(error) {
      logger.error("Server error");
      console.error(error);
      return new Response("Server error occurred", { status: 500 });
    },
  });

server();

logger.info(`Static file server running at http://localhost:${PORT}`);
logger.info(`Serving files from: ${BASE_PATH}`);
