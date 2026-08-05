import { adminService as defaultAdminService } from "./admin.ts";
import type { AdminService } from "./admin.ts";
import { getAdminPassword } from "./config.ts";
import { download } from "./download.ts";
import type { DownloadProgress, DownloadProgressHandler, DownloadResult } from "./download.ts";
import { getYoutubeVideoId } from "./helpers.ts";
import { timingSafeEqual } from "node:crypto";

type DownloadVideo = (videoId: string, progressHandler?: DownloadProgressHandler) => Promise<DownloadResult>;

interface AdminJob {
  id: string;
  videoId: string;
  status: "processing" | "completed";
  progress: DownloadProgress;
  result?: DownloadResult["status"];
}

export interface AdminHandlerOptions {
  password?: string;
  service?: AdminService;
  downloadVideo?: DownloadVideo;
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
  if (!match) return null;

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

const toVideoDto = (video: ReturnType<AdminService["listVideos"]>[number]) => ({
  id: video.video_id,
  title: video.video_name,
  url: video.video_url,
  addedAt: video.video_added_date,
  duration: video.video_length,
});

const defaultDownloadVideo: DownloadVideo = (videoId, progressHandler) => download(videoId, undefined, progressHandler);

const getTerminalProgress = (result: DownloadResult["status"], currentProgress: DownloadProgress): DownloadProgress => {
  if (result === "failed") {
    return { ...currentProgress, stage: "failed", message: "Episode processing failed" };
  }

  const messages: Record<Exclude<DownloadResult["status"], "failed">, string> = {
    published: "Episode published",
    recovered: "Episode publication recovered",
    "already-published": "Episode already published",
  };
  return { stage: "completed", percent: 100, message: messages[result] };
};

export const createAdminHandler = ({
  password = getAdminPassword(),
  service = defaultAdminService,
  downloadVideo = defaultDownloadVideo,
  adminPagePath = "./public/admin.html",
}: AdminHandlerOptions = {}) => {
  const jobs = new Map<string, AdminJob>();

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

    if (pathname === "/api/admin/videos" && request.method === "GET") {
      return jsonResponse({ videos: service.listVideos().map(toVideoDto) });
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

      if (service.listVideos().some((video) => video.video_id === videoId)) {
        return jsonResponse({ error: "This video is already in the RSS feed." }, 409);
      }

      const runningJob = [...jobs.values()].find((job) => job.videoId === videoId && job.status === "processing");
      if (runningJob) {
        return jsonResponse({ job: runningJob }, 202);
      }

      const job: AdminJob = {
        id: crypto.randomUUID(),
        videoId,
        status: "processing",
        progress: { stage: "queued", percent: 0, message: "Waiting to start" },
      };
      jobs.set(job.id, job);

      void downloadVideo(videoId, (progress) => {
        const currentJob = jobs.get(job.id);
        if (currentJob?.status === "processing") {
          jobs.set(job.id, { ...currentJob, progress });
        }
      })
        .then((result) => {
          const currentJob = jobs.get(job.id) ?? job;
          jobs.set(job.id, {
            ...currentJob,
            status: "completed",
            result: result.status,
            progress: getTerminalProgress(result.status, currentJob.progress),
          });
        })
        .catch(() => {
          const currentJob = jobs.get(job.id) ?? job;
          jobs.set(job.id, {
            ...currentJob,
            status: "completed",
            result: "failed",
            progress: getTerminalProgress("failed", currentJob.progress),
          });
        });

      return jsonResponse({ job }, 202);
    }

    const videoId = parseVideoIdPath(pathname);
    if (videoId && request.method === "DELETE") {
      try {
        const video = await service.deleteVideo(videoId);
        return jsonResponse({ deleted: toVideoDto(video) });
      } catch (error) {
        const status = error instanceof Error && error.name === "AdminVideoNotFoundError" ? 404 : 500;
        return jsonResponse(
          {
            error: status === 404 ? "Video not found." : "The episode could not be fully deleted. Please try again.",
          },
          status
        );
      }
    }

    const jobId = parseJobIdPath(pathname);
    if (jobId && request.method === "GET") {
      const job = jobs.get(jobId);
      return job ? jsonResponse({ job }) : jsonResponse({ error: "Job not found." }, 404);
    }

    return jsonResponse({ error: "Route not found." }, 404);
  };
};
