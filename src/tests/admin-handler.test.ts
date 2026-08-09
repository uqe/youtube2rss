import { describe, expect, it } from "bun:test";

import { createAdminHandler } from "../admin-handler.ts";
import type { AdminService } from "../admin.ts";
import type { StoredVideo } from "../db.ts";

const password = "secret";
const authorization = `Basic ${Buffer.from(`admin:${password}`).toString("base64")}`;
const authHeaders = { Authorization: authorization };

const video: StoredVideo = {
  video_id: "dQw4w9WgXcQ",
  video_name: "Never Gonna Give You Up",
  video_description: null,
  video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  video_added_date: "2026-01-01T00:00:00.000Z",
  video_path: "/tmp/dQw4w9WgXcQ.mp3",
  video_length: 213,
  publication_status: "published",
  is_deleted: false,
};

const createService = (): AdminService => ({
  listVideos: () => [video],
  async deleteVideo(): Promise<StoredVideo> {
    return { ...video, is_deleted: true };
  },
});

describe("admin HTTP handler", () => {
  it("should hide admin routes when no password is configured", async () => {
    const handler = createAdminHandler({ password: "", service: createService() });
    const response = await handler(new Request("http://localhost/api/admin/videos"));

    expect(response.status).toBe(404);
  });

  it("should require Basic authentication", async () => {
    const handler = createAdminHandler({ password, service: createService() });
    const response = await handler(new Request("http://localhost/api/admin/videos"));

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Basic");
  });

  it("should return active videos without exposing local file paths", async () => {
    const handler = createAdminHandler({ password, service: createService() });
    const response = await handler(new Request("http://localhost/api/admin/videos", { headers: authHeaders }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.videos).toEqual([
      {
        id: video.video_id,
        title: video.video_name,
        url: video.video_url,
        addedAt: video.video_added_date,
        duration: video.video_length,
      },
    ]);
    expect(JSON.stringify(body)).not.toContain(video.video_path);
  });

  it("should validate new YouTube URLs", async () => {
    const handler = createAdminHandler({
      password,
      service: { ...createService(), listVideos: () => [] },
    });
    const response = await handler(
      new Request("http://localhost/api/admin/videos", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ url: "https://example.com/video" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("should reject malformed JSON request bodies", async () => {
    const handler = createAdminHandler({
      password,
      service: { ...createService(), listVideos: () => [] },
    });
    const response = await handler(
      new Request("http://localhost/api/admin/videos", {
        method: "POST",
        headers: authHeaders,
        body: "{broken",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The request body must contain valid JSON." });
  });

  it("should reject missing, non-string, and blank URL fields", async () => {
    const handler = createAdminHandler({
      password,
      service: { ...createService(), listVideos: () => [] },
    });

    for (const body of [{}, { url: 123 }, { url: "   " }, null]) {
      const response = await handler(
        new Request("http://localhost/api/admin/videos", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(body),
        }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Enter a valid YouTube video URL." });
    }
  });

  it("should reject oversized URL input without starting a download", async () => {
    let downloadCalls = 0;
    const handler = createAdminHandler({
      password,
      service: { ...createService(), listVideos: () => [] },
      async downloadVideo() {
        downloadCalls += 1;
        return { status: "published" };
      },
    });
    const response = await handler(
      new Request("http://localhost/api/admin/videos", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ url: `https://youtu.be/${"a".repeat(2049)}` }),
      }),
    );

    expect(response.status).toBe(400);
    expect(downloadCalls).toBe(0);
  });

  it("should reject a video that is already active without starting a download", async () => {
    let downloadCalls = 0;
    const handler = createAdminHandler({
      password,
      service: createService(),
      async downloadVideo() {
        downloadCalls += 1;
        return { status: "published" };
      },
    });
    const response = await handler(
      new Request("http://localhost/api/admin/videos", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ url: video.video_url }),
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "This video is already in the RSS feed." });
    expect(downloadCalls).toBe(0);
  });

  it("should enqueue a valid video and expose its job result", async () => {
    let finishDownload: (() => void) | undefined;
    const handler = createAdminHandler({
      password,
      service: { ...createService(), listVideos: () => [] },
      downloadVideo(_videoId, progressHandler) {
        progressHandler?.({
          stage: "download",
          percent: 12,
          message: "Downloading and converting audio",
        });
        return new Promise((resolve) => {
          finishDownload = () => resolve({ status: "published" });
        });
      },
    });
    const createResponse = await handler(
      new Request("http://localhost/api/admin/videos", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ url: video.video_url }),
      }),
    );
    const created = await createResponse.json();
    expect(created.job.progress).toEqual({
      stage: "queued",
      percent: 0,
      message: "Waiting to start",
    });
    const processingResponse = await handler(
      new Request(`http://localhost/api/admin/jobs/${created.job.id}`, { headers: authHeaders }),
    );
    const processing = await processingResponse.json();

    expect(processing.job).toMatchObject({
      status: "processing",
      progress: {
        stage: "download",
        percent: 12,
        message: "Downloading and converting audio",
      },
    });

    finishDownload?.();
    await Promise.resolve();
    const jobResponse = await handler(
      new Request(`http://localhost/api/admin/jobs/${created.job.id}`, { headers: authHeaders }),
    );
    const completed = await jobResponse.json();

    expect(createResponse.status).toBe(202);
    expect(completed.job).toMatchObject({
      videoId: video.video_id,
      status: "completed",
      result: "published",
      progress: {
        stage: "completed",
        percent: 100,
        message: "Episode published",
      },
    });
  });

  it("should enqueue a video that was removed from the active feed", async () => {
    let receivedVideoId = "";
    const handler = createAdminHandler({
      password,
      service: { ...createService(), listVideos: () => [] },
      async downloadVideo(videoId) {
        receivedVideoId = videoId;
        return { status: "published" };
      },
    });

    const response = await handler(
      new Request("http://localhost/api/admin/videos", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ url: video.video_url }),
      }),
    );

    expect(response.status).toBe(202);
    expect(receivedVideoId).toBe(video.video_id);
  });

  it("should return the existing job when the same video is already processing", async () => {
    let finishDownload: (() => void) | undefined;
    let downloadCalls = 0;
    const handler = createAdminHandler({
      password,
      service: { ...createService(), listVideos: () => [] },
      downloadVideo() {
        downloadCalls += 1;
        return new Promise((resolve) => {
          finishDownload = () => resolve({ status: "published" });
        });
      },
    });
    const request = () =>
      new Request("http://localhost/api/admin/videos", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ url: video.video_url }),
      });

    const firstResponse = await handler(request());
    const secondResponse = await handler(request());
    const first = await firstResponse.json();
    const second = await secondResponse.json();

    expect(secondResponse.status).toBe(202);
    expect(second.job.id).toBe(first.job.id);
    expect(downloadCalls).toBe(1);

    finishDownload?.();
    await Promise.resolve();
  });

  for (const [status, message] of [
    ["recovered", "Episode publication recovered"],
    ["already-published", "Episode already published"],
    ["failed", "Episode processing failed"],
  ] as const) {
    it(`should expose the ${status} terminal download state`, async () => {
      const handler = createAdminHandler({
        password,
        service: { ...createService(), listVideos: () => [] },
        async downloadVideo() {
          return { status };
        },
      });
      const createResponse = await handler(
        new Request("http://localhost/api/admin/videos", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ url: video.video_url }),
        }),
      );
      const created = await createResponse.json();
      await Promise.resolve();
      const jobResponse = await handler(
        new Request(`http://localhost/api/admin/jobs/${created.job.id}`, { headers: authHeaders }),
      );
      const completed = await jobResponse.json();

      expect(completed.job).toMatchObject({
        status: "completed",
        result: status,
        progress: {
          stage: status === "failed" ? "failed" : "completed",
          percent: status === "failed" ? 0 : 100,
          message,
        },
      });
    });
  }

  it("should convert a rejected download into a failed terminal job", async () => {
    const handler = createAdminHandler({
      password,
      service: { ...createService(), listVideos: () => [] },
      async downloadVideo() {
        throw new Error("network unavailable");
      },
    });
    const createResponse = await handler(
      new Request("http://localhost/api/admin/videos", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ url: video.video_url }),
      }),
    );
    const created = await createResponse.json();
    await Promise.resolve();
    await Promise.resolve();
    const jobResponse = await handler(
      new Request(`http://localhost/api/admin/jobs/${created.job.id}`, { headers: authHeaders }),
    );
    const completed = await jobResponse.json();

    expect(completed.job).toMatchObject({
      status: "completed",
      result: "failed",
      progress: { stage: "failed", percent: 0, message: "Episode processing failed" },
    });
  });

  it("should return 404 for an unknown job", async () => {
    const handler = createAdminHandler({ password, service: createService() });
    const response = await handler(new Request("http://localhost/api/admin/jobs/unknown", { headers: authHeaders }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Job not found." });
  });

  it("should delete a video through the admin service", async () => {
    let deletedVideoId = "";
    const handler = createAdminHandler({
      password,
      service: {
        ...createService(),
        async deleteVideo(videoId) {
          deletedVideoId = videoId;
          return { ...video, is_deleted: true };
        },
      },
    });
    const response = await handler(
      new Request(`http://localhost/api/admin/videos/${video.video_id}`, {
        method: "DELETE",
        headers: authHeaders,
      }),
    );

    expect(response.status).toBe(200);
    expect(deletedVideoId).toBe(video.video_id);
  });

  it("should decode the video ID before deletion", async () => {
    let deletedVideoId = "";
    const handler = createAdminHandler({
      password,
      service: {
        ...createService(),
        async deleteVideo(videoId) {
          deletedVideoId = videoId;
          return { ...video, video_id: videoId, is_deleted: true };
        },
      },
    });
    const response = await handler(
      new Request("http://localhost/api/admin/videos/video%20id", {
        method: "DELETE",
        headers: authHeaders,
      }),
    );

    expect(response.status).toBe(200);
    expect(deletedVideoId).toBe("video id");
  });

  it("should return 404 when deleting an unknown video", async () => {
    const handler = createAdminHandler({
      password,
      service: {
        ...createService(),
        async deleteVideo() {
          const error = new Error("missing");
          error.name = "AdminVideoNotFoundError";
          throw error;
        },
      },
    });
    const response = await handler(
      new Request(`http://localhost/api/admin/videos/${video.video_id}`, {
        method: "DELETE",
        headers: authHeaders,
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Video not found." });
  });

  it("should hide internal deletion errors behind a generic response", async () => {
    const handler = createAdminHandler({
      password,
      service: {
        ...createService(),
        async deleteVideo() {
          throw new Error("secret storage failure");
        },
      },
    });
    const response = await handler(
      new Request(`http://localhost/api/admin/videos/${video.video_id}`, {
        method: "DELETE",
        headers: authHeaders,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "The episode could not be fully deleted. Please try again." });
    expect(JSON.stringify(body)).not.toContain("secret storage failure");
  });

  it("should serve the protected admin document with restrictive headers", async () => {
    const handler = createAdminHandler({ password, service: createService() });
    const response = await handler(new Request("http://localhost/admin", { headers: authHeaders }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    const document = await response.text();
    expect(document).toContain("Published episodes");
    expect(document).toContain('rel="icon" href="/admin-favicon.svg"');
    expect(document).toContain('role="progressbar"');
  });

  it("should serve admin HEAD requests without a response body", async () => {
    const handler = createAdminHandler({ password, service: createService() });
    const response = await handler(
      new Request("http://localhost/admin.html", { method: "HEAD", headers: authHeaders }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
  });

  it("should return 404 when the configured admin document is missing", async () => {
    const handler = createAdminHandler({
      password,
      service: createService(),
      adminPagePath: "./src/tests/data/missing-admin-page.html",
    });
    const response = await handler(new Request("http://localhost/admin", { headers: authHeaders }));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Admin page not found");
  });

  it("should return a no-store JSON 404 for unmatched authenticated routes", async () => {
    const handler = createAdminHandler({ password, service: createService() });
    const response = await handler(new Request("http://localhost/api/admin/unknown", { headers: authHeaders }));

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Route not found." });
  });
});
