import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { execPath } from "node:process";

import { createJobWorker } from "../job-worker.ts";
import { createJobRepository } from "../jobs.ts";
import { createTestLibrary, sampleVideo } from "./library-fixture.ts";

let library: Awaited<ReturnType<typeof createTestLibrary>>;
beforeEach(async () => {
  library = await createTestLibrary();
});
afterEach(async () => {
  await library.dispose();
});

describe("persistent media queue", () => {
  it("should share and deduplicate jobs across repository instances", () => {
    const other = createJobRepository({ dbFactory: library.dbFactory });
    const job = library.jobs.enqueue({ kind: "download", videoId: sampleVideo.video_id });
    expect(other.enqueue({ kind: "download", videoId: sampleVideo.video_id }).id).toBe(job.id);
    expect(other.get(job.id)?.status).toBe("queued");
    library.jobs.claim("owner");
    expect(other.claim("other")).toBeNull();
    other.finish(job.id, "wrong-owner", "published");
    expect(library.jobs.get(job.id)?.status).toBe("processing");
  });
  it("should recover work only after the owning process has died", async () => {
    const job = library.jobs.enqueue({ kind: "refresh" });
    const child = Bun.spawn(
      [execPath, "--no-env-file", `${import.meta.dir}/data/claim-job.ts`, library.dbFactory.fileName()],
      { stdout: "pipe", stderr: "pipe", stdin: "pipe" },
    );
    try {
      const chunk = await child.stdout.getReader().read();
      expect(new TextDecoder().decode(chunk.value).trim()).toBe(job.id);
      expect(library.jobs.claim("parent")).toBeNull();
      expect(library.jobs.get(job.id)?.status).toBe("processing");
    } finally {
      child.kill();
      await child.exited;
    }
    const recovered = library.jobs.claim("parent");
    expect(recovered?.id).toBe(job.id);
    expect(recovered?.attempts).toBe(2);
    library.jobs.finish(job.id, "child", "published");
    expect(library.jobs.get(job.id)?.status).toBe("processing");
    library.jobs.finish(job.id, "parent", "updated");
    expect(library.jobs.get(job.id)?.result).toBe("updated");
  });
  it("should preserve FIFO ordering while a failed operation waits for retry", () => {
    let now = 1000;
    const jobs = createJobRepository({ dbFactory: library.dbFactory, now: () => now });
    const first = jobs.enqueue({ kind: "download", videoId: sampleVideo.video_id });
    jobs.enqueue({ kind: "delete", videoId: sampleVideo.video_id });
    expect(jobs.claim("owner")?.id).toBe(first.id);
    jobs.finish(first.id, "owner", "failed", 500);
    expect(jobs.claim("owner")).toBeNull();
    now += 500;
    expect(jobs.claim("owner")?.id).toBe(first.id);
    jobs.finish(first.id, "owner", "published");
    expect(jobs.claim("owner")?.kind).toBe("delete");
  });
  it("should recover legacy pending publications once without reviving failed jobs on every restart", () => {
    library.videos.create(sampleVideo, "pending");
    library.jobs.recoverPending();
    library.jobs.recoverPending();
    expect(library.jobs.list()).toHaveLength(1);
    const job = library.jobs.claim("owner");
    expect(job?.videoId).toBe(sampleVideo.video_id);
    library.jobs.finish(job?.id ?? "", "owner", "failed");
    library.jobs.recoverPending();
    expect(library.jobs.list()).toHaveLength(1);
    expect(library.jobs.list()[0].result).toBe("failed");
  });
  it("should stop automatic retries after three attempts and permit manual retry", async () => {
    const job = library.jobs.enqueue({ kind: "download", videoId: sampleVideo.video_id });
    const worker = createJobWorker({ ...library, retryDelayMs: 0, downloadVideo: async () => ({ status: "failed" }) });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await worker.runOnce();
    }
    expect(library.jobs.get(job.id)).toMatchObject({ status: "completed", result: "failed", attempts: 3 });
    expect(await worker.runOnce()).toBe(false);
    expect(library.jobs.retry(job.id)).toMatchObject({ status: "queued", attempts: 0 });
  });
  it("should keep workers from overlapping during an asynchronous operation", async () => {
    library.jobs.enqueue({ kind: "download", videoId: sampleVideo.video_id });
    library.jobs.enqueue({ kind: "delete", videoId: sampleVideo.video_id });
    const gate = Promise.withResolvers<void>();
    const started = Promise.withResolvers<void>();
    const first = createJobWorker({
      ...library,
      downloadVideo: async () => {
        started.resolve();
        await gate.promise;
        return { status: "published" };
      },
    });
    let deleted = false;
    const second = createJobWorker({
      ...library,
      deleteVideo: async () => {
        deleted = true;
      },
    });
    const running = first.runOnce();
    try {
      await started.promise;
      expect(await second.runOnce()).toBe(false);
      expect(deleted).toBe(false);
    } finally {
      gate.resolve();
      await running;
    }
    expect(await second.runOnce()).toBe(true);
    expect(deleted).toBe(true);
  });
  it("should persist progress and turn a thrown operation into a retry", async () => {
    const job = library.jobs.enqueue({ kind: "download", videoId: sampleVideo.video_id });
    const worker = createJobWorker({
      ...library,
      retryDelayMs: 0,
      log: { error() {} },
      downloadVideo: async (_id, progress) => {
        progress({ stage: "metadata", percent: 54, message: "Metadata" });
        expect(library.jobs.get(job.id)?.progress.stage).toBe("metadata");
        throw new Error("Unexpected failure");
      },
    });
    await worker.runOnce();
    expect(library.jobs.get(job.id)).toMatchObject({ status: "queued", attempts: 1 });
  });
  it("should reuse an existing active request when retrying the same failed operation", () => {
    const failed = library.jobs.enqueue({ kind: "refresh" });
    library.jobs.claim("owner");
    library.jobs.finish(failed.id, "owner", "failed");
    const active = library.jobs.enqueue({ kind: "refresh" });
    expect(library.jobs.retry(failed.id)?.id).toBe(active.id);
  });
});

it("should queue another refresh when a collection is created during publication", () => {
  const running = library.jobs.enqueue({ kind: "refresh" });
  library.jobs.claim("owner");
  const followup = library.jobs.enqueue({ kind: "refresh" });
  expect(followup.id).not.toBe(running.id);
  expect(library.jobs.enqueue({ kind: "refresh" }).id).toBe(followup.id);
  library.jobs.finish(running.id, "owner", "updated");
  expect(library.jobs.claim("owner")?.id).toBe(followup.id);
});

it("should let the same idle worker recover a claim after a failed completion write", () => {
  const job = library.jobs.enqueue({ kind: "refresh" });
  library.jobs.claim("owner");
  expect(library.jobs.claim("other")).toBeNull();
  expect(library.jobs.claim("owner")?.id).toBe(job.id);
});
