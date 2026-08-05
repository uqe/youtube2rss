import { createAdminHandler } from "../admin-handler.ts";
import type { AdminService } from "../admin.ts";
import type { StoredVideo } from "../db.ts";
import { describe, expect, it } from "bun:test";

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
    const handler = createAdminHandler({ password, service: { ...createService(), listVideos: () => [] } });
    const response = await handler(
      new Request("http://localhost/api/admin/videos", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ url: "https://example.com/video" }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("should enqueue a valid video and expose its job result", async () => {
    let finishDownload: (() => void) | undefined;
    const handler = createAdminHandler({
      password,
      service: { ...createService(), listVideos: () => [] },
      downloadVideo(_videoId, progressHandler) {
        progressHandler?.({ stage: "download", percent: 12, message: "Downloading and converting audio" });
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
      })
    );
    const created = await createResponse.json();
    expect(created.job.progress).toEqual({ stage: "queued", percent: 0, message: "Waiting to start" });
    const processingResponse = await handler(
      new Request(`http://localhost/api/admin/jobs/${created.job.id}`, { headers: authHeaders })
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
      new Request(`http://localhost/api/admin/jobs/${created.job.id}`, { headers: authHeaders })
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
      })
    );

    expect(response.status).toBe(202);
    expect(receivedVideoId).toBe(video.video_id);
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
      })
    );

    expect(response.status).toBe(200);
    expect(deletedVideoId).toBe(video.video_id);
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
});
