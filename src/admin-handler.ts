import { timingSafeEqual } from "node:crypto";

import { adminService as defaultAdminService } from "./admin.ts";
import type { AdminService } from "./admin.ts";
import { collectionRepository } from "./collections.ts";
import type { CollectionRepository } from "./collections.ts";
import { getAdminPassword, getRequiredServerUrl } from "./config.ts";
import { videoRepository } from "./db.ts";
import type { VideoRepository } from "./db.ts";
import { getYoutubeVideoId } from "./helpers.ts";
import { jobRepository } from "./jobs.ts";
import type { JobRepository } from "./jobs.ts";

export interface AdminHandlerOptions {
  password?: string;
  service?: AdminService;
  jobs?: JobRepository;
  collections?: CollectionRepository;
  videos?: VideoRepository;
  baseUrl?: string;
  adminPagePath?: string;
}

const jsonResponse = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

const isAuthorized = (request: Request, password: string) => {
  const authorization = request.headers.get("Authorization") ?? "";
  const expected = `Basic ${Buffer.from(`admin:${password}`).toString("base64")}`;
  const actualBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
};

const unauthorizedResponse = () =>
  new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="youtube2rss admin", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });

const parseVideoIdPath = (pathname: string) => {
  const match = /^\/api\/admin\/videos\/([^/]+)$/.exec(pathname);
  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

const parseJobIdPath = (pathname: string) => {
  const match = /^\/api\/admin\/jobs\/([^/]+)$/.exec(pathname);
  return match?.[1] ?? null;
};

const toVideoDto = (
  video: ReturnType<AdminService["listVideos"]>[number],
  publicationStatus: string | null = null,
) => ({
  publicationStatus,
  id: video.video_id,
  title: video.video_name,
  url: video.video_url,
  addedAt: video.video_added_date,
  duration: video.video_length,
});

export const createAdminHandler = ({
  password = getAdminPassword(),
  service = defaultAdminService,
  jobs = jobRepository,
  collections = collectionRepository,
  videos = videoRepository,
  baseUrl,
  adminPagePath = "./public/admin.html",
}: AdminHandlerOptions = {}) => {
  return async (request: Request): Promise<Response> => {
    const { pathname } = new URL(request.url);

    if (!password) {
      return new Response("Not found", { status: 404 });
    }

    if (!isAuthorized(request, password)) {
      return unauthorizedResponse();
    }

    if (
      (pathname === "/admin" || pathname === "/admin.html") &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      const file = Bun.file(adminPagePath);
      if (!(await file.exists())) {
        return new Response("Admin page not found", { status: 404 });
      }

      return new Response(request.method === "HEAD" ? null : file, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy":
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
        },
      });
    }

    const collectionMatch = /^\/api\/admin\/collections\/([a-f0-9-]{36})\/videos\/([\w-]+)$/.exec(pathname);
    if (collectionMatch && ["PUT", "DELETE"].includes(request.method)) {
      const [, collectionId, videoId] = collectionMatch;
      if (!collections.get(collectionId) || !videos.exists(videoId)) {
        return jsonResponse({ error: "Collection or episode not found." }, 404);
      }
      return jsonResponse(
        {
          job: jobs.enqueue({
            kind: request.method === "PUT" ? "collection-add" : "collection-remove",
            collectionId,
            videoId,
          }),
        },
        202,
      );
    }
    if (pathname === "/api/admin/collections" && request.method === "GET") {
      return jsonResponse({
        collections: collections.list().map((item) => ({
          id: item.id,
          name: item.name,
          createdAt: item.createdAt,
          feedUrl: `${baseUrl ?? getRequiredServerUrl()}/feeds/${item.id}.xml`,
        })),
        feedUrl: `${baseUrl ?? getRequiredServerUrl()}/rss.xml`,
      });
    }
    if (pathname === "/api/admin/collections" && request.method === "POST") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "The request body must contain valid JSON." }, 400);
      }
      const name =
        typeof body === "object" && body && "name" in body && typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 80) {
        return jsonResponse({ error: "Enter a collection name of 1–80 characters." }, 400);
      }
      const collection = collections.create(name);
      jobs.enqueue({ kind: "refresh" });
      return jsonResponse({ collection }, 201);
    }
    if (pathname === "/api/admin/jobs" && request.method === "GET") {
      return jsonResponse({ jobs: jobs.list() });
    }
    const retryMatch = /^\/api\/admin\/jobs\/([a-f0-9-]{36})\/retry$/.exec(pathname);
    if (retryMatch && request.method === "POST") {
      const job = jobs.retry(retryMatch[1]);
      return job ? jsonResponse({ job }, 202) : jsonResponse({ error: "Failed job not found." }, 404);
    }
    if (pathname === "/api/admin/videos" && request.method === "GET") {
      const collectionId = new URL(request.url).searchParams.get("collection");
      if (collectionId && !collections.get(collectionId)) {
        return jsonResponse({ error: "Collection not found." }, 404);
      }
      const items = collectionId ? collections.videos(collectionId) : service.listVideos();
      return jsonResponse({
        videos: items.map((video) => toVideoDto(video, videos.getPublicationStatus(video.video_id))),
      });
    }

    if (pathname === "/api/admin/videos" && request.method === "POST") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "The request body must contain valid JSON." }, 400);
      }

      const url =
        typeof body === "object" && body !== null && "url" in body && typeof body.url === "string"
          ? body.url.trim()
          : "";
      const videoId = url.length <= 2048 ? getYoutubeVideoId(url) : null;
      if (!videoId) {
        return jsonResponse({ error: "Enter a valid YouTube video URL." }, 400);
      }

      const collectionId = typeof body === "object" && body && "collectionId" in body ? body.collectionId : undefined;
      if (collectionId !== undefined && (typeof collectionId !== "string" || !collections.get(collectionId))) {
        return jsonResponse({ error: "Collection not found." }, 400);
      }
      const published = videos.getPublicationStatus(videoId) === "published";
      if (published && !collectionId) {
        return jsonResponse({ error: "This video is already in the RSS feed." }, 409);
      }
      return jsonResponse(
        { job: jobs.enqueue({ kind: published ? "collection-add" : "download", videoId, collectionId }) },
        202,
      );
    }

    const videoId = parseVideoIdPath(pathname);
    if (videoId && request.method === "DELETE") {
      if (!videos.findById(videoId)) {
        return jsonResponse({ error: "Video not found." }, 404);
      }
      return jsonResponse({ job: jobs.enqueue({ kind: "delete", videoId }) }, 202);
    }

    const jobId = parseJobIdPath(pathname);
    if (jobId && request.method === "GET") {
      const job = jobs.get(jobId);
      return job ? jsonResponse({ job }) : jsonResponse({ error: "Job not found." }, 404);
    }

    return jsonResponse({ error: "Route not found." }, 404);
  };
};
