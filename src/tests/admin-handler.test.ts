import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { createAdminHandler } from "../admin-handler.ts";
import { createAdminService } from "../admin.ts";
import { createJobWorker } from "../job-worker.ts";
import { createTestLibrary, sampleVideo } from "./library-fixture.ts";

const authHeaders = { Authorization: `Basic ${Buffer.from("admin:secret").toString("base64")}` };
let library: Awaited<ReturnType<typeof createTestLibrary>>;
const createHandler = () =>
  createAdminHandler({
    password: "secret",
    jobs: library.jobs,
    collections: library.collections,
    videos: library.videos,
    service: createAdminService({ repository: library.videos }),
    baseUrl: "https://podcast.test",
  });
const request = (path: string, method = "GET", body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: authHeaders,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
beforeEach(async () => {
  library = await createTestLibrary();
});
afterEach(async () => {
  await library.dispose();
});

describe("admin HTTP handler", () => {
  it("should hide admin routes without a password and require authentication otherwise", async () => {
    expect((await createAdminHandler({ password: "" })(new Request("http://localhost/admin"))).status).toBe(404);
    const response = await createHandler()(new Request("http://localhost/api/admin/videos"));
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Basic");
    expect(
      (
        await createHandler()(
          new Request("http://localhost/api/admin/videos", { headers: { Authorization: "Basic wrong" } }),
        )
      ).status,
    ).toBe(401);
  });
  it("should return video metadata and publication state without local paths", async () => {
    library.videos.create(sampleVideo, "pending");
    const response = await createHandler()(request("/api/admin/videos"));
    const body = await response.json();
    expect(body.videos).toEqual([
      {
        id: sampleVideo.video_id,
        title: sampleVideo.video_name,
        url: sampleVideo.video_url,
        addedAt: sampleVideo.video_added_date,
        duration: sampleVideo.video_length,
        publicationStatus: "pending",
      },
    ]);
    expect(JSON.stringify(body)).not.toContain(sampleVideo.video_path);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it.each([
    {},
    null,
    { url: 42 },
    { url: " " },
    { url: "https://example.com" },
    { url: `https://youtu.be/${"a".repeat(2049)}` },
  ])("should reject invalid input %j", async (body) => {
    expect((await createHandler()(request("/api/admin/videos", "POST", body))).status).toBe(400);
    expect(library.jobs.list()).toEqual([]);
  });
  it("should reject malformed JSON", async () => {
    const response = await createHandler()(
      new Request("http://localhost/api/admin/videos", { method: "POST", headers: authHeaders, body: "{" }),
    );
    expect(response.status).toBe(400);
  });
  it("should reject published duplicates but allow a pending publication to recover", async () => {
    library.videos.create(sampleVideo, "pending");
    const handler = createHandler();
    const response = await handler(request("/api/admin/videos", "POST", { url: sampleVideo.video_url }));
    expect(response.status).toBe(202);
    expect((await response.json()).job.kind).toBe("download");
    library.videos.markPublished(sampleVideo.video_id);
    expect((await handler(request("/api/admin/videos", "POST", { url: sampleVideo.video_url }))).status).toBe(409);
  });
  it("should persist and deduplicate jobs across handler instances", async () => {
    const first = await createHandler()(request("/api/admin/videos", "POST", { url: sampleVideo.video_url }));
    const job = (await first.json()).job;
    const second = await createHandler()(request("/api/admin/videos", "POST", { url: sampleVideo.video_url }));
    expect((await second.json()).job.id).toBe(job.id);
    expect((await (await createHandler()(request(`/api/admin/jobs/${job.id}`))).json()).job.status).toBe("queued");
    expect(library.jobs.list()).toHaveLength(1);
  });
  it.each(["published", "recovered", "already-published", "failed"] as const)(
    "should expose the worker result %s",
    async (status) => {
      const job = library.jobs.enqueue({ kind: "download", videoId: sampleVideo.video_id });
      const worker = createJobWorker({ ...library, downloadVideo: async () => ({ status }), retryDelayMs: 0 });
      await worker.runOnce();
      if (status === "failed") {
        await worker.runOnce();
        await worker.runOnce();
      }
      const response = await createHandler()(request(`/api/admin/jobs/${job.id}`));
      expect((await response.json()).job).toMatchObject({ status: "completed", result: status });
    },
  );
  it("should enqueue deletion without changing records in the web process", async () => {
    library.videos.create(sampleVideo);
    const response = await createHandler()(request(`/api/admin/videos/${sampleVideo.video_id}`, "DELETE"));
    expect(response.status).toBe(202);
    expect((await response.json()).job.kind).toBe("delete");
    expect(library.videos.exists(sampleVideo.video_id)).toBe(true);
    expect((await createHandler()(request("/api/admin/videos/missing", "DELETE"))).status).toBe(404);
  });
  it("should retry failed jobs and expose the queue", async () => {
    const job = library.jobs.enqueue({ kind: "refresh" });
    library.jobs.claim("test");
    library.jobs.finish(job.id, "test", "failed");
    const response = await createHandler()(request(`/api/admin/jobs/${job.id}/retry`, "POST"));
    expect(response.status).toBe(202);
    expect((await response.json()).job.status).toBe("queued");
    expect((await (await createHandler()(request("/api/admin/jobs"))).json()).jobs).toHaveLength(1);
  });
  it("should create collections and return their RSS addresses", async () => {
    const handler = createHandler();
    const response = await handler(request("/api/admin/collections", "POST", { name: "Интервью" }));
    expect(response.status).toBe(201);
    const { collection } = await response.json();
    const list = await (await handler(request("/api/admin/collections"))).json();
    expect(list.collections[0].feedUrl).toBe(`https://podcast.test/feeds/${collection.id}.xml`);
    expect(library.jobs.list()[0].kind).toBe("refresh");
  });
  it.each([{}, { name: " " }, { name: "a".repeat(81) }])("should reject an invalid collection %j", async (body) => {
    expect((await createHandler()(request("/api/admin/collections", "POST", body))).status).toBe(400);
  });
  it("should queue collection membership for an existing episode without downloading it", async () => {
    library.videos.create(sampleVideo);
    const collection = library.collections.create("Interviews");
    const handler = createHandler();
    const response = await handler(
      request("/api/admin/videos", "POST", { url: sampleVideo.video_url, collectionId: collection.id }),
    );
    expect((await response.json()).job.kind).toBe("collection-add");
    const worker = createJobWorker({ ...library, publish: async () => {} });
    await worker.runOnce();
    const filtered = await handler(request(`/api/admin/videos?collection=${collection.id}`));
    expect((await filtered.json()).videos).toHaveLength(1);
    const removal = await handler(
      request(`/api/admin/collections/${collection.id}/videos/${sampleVideo.video_id}`, "DELETE"),
    );
    expect((await removal.json()).job.kind).toBe("collection-remove");
  });
  it("should reject unknown collections", async () => {
    expect(
      (
        await createHandler()(
          request("/api/admin/videos", "POST", { url: sampleVideo.video_url, collectionId: "missing" }),
        )
      ).status,
    ).toBe(400);
    expect((await createHandler()(request("/api/admin/videos?collection=missing"))).status).toBe(404);
  });
  it("should serve protected HTML and HEAD with restrictive headers", async () => {
    const handler = createHandler();
    const response = await handler(request("/admin"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(await response.text()).toContain("Published episodes");
    expect(await (await handler(request("/admin.html", "HEAD"))).text()).toBe("");
    const missing = createAdminHandler({ password: "secret", adminPagePath: "/nonexistent/admin.html" });
    expect((await missing(request("/admin"))).status).toBe(404);
  });
  it("should return no-store JSON 404 for unknown jobs and routes", async () => {
    for (const path of ["/api/admin/jobs/missing", "/api/admin/missing"]) {
      const response = await createHandler()(request(path));
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });
});
