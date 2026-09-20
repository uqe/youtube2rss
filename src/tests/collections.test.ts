import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";

import { createCollectionRepository } from "../collections.ts";
import { generateFeed } from "../generate-feed.ts";
import { createJobWorker } from "../job-worker.ts";
import { createFeedPublisher } from "../publish-feeds.ts";
import { createLocalStorage } from "../storage.ts";
import { createTestLibrary, sampleVideo } from "./library-fixture.ts";

let library: Awaited<ReturnType<typeof createTestLibrary>>;
beforeEach(async () => {
  library = await createTestLibrary();
});
afterEach(async () => {
  await library.dispose();
});

describe("collection feeds", () => {
  it("should persist collections with stable IDs and reject empty or long names", () => {
    const collection = library.collections.create("  Interviews  ");
    expect(library.collections.create("interviews").id).toBe(collection.id);
    expect(createCollectionRepository(library.dbFactory).get(collection.id)?.name).toBe("Interviews");
    expect(() => library.collections.create(" ")).toThrow();
    expect(() => library.collections.create("x".repeat(81))).toThrow();
  });
  it("should share an episode across collections and remove membership independently", () => {
    library.videos.create(sampleVideo);
    const first = library.collections.create("First");
    const second = library.collections.create("Second");
    library.collections.add(first.id, sampleVideo.video_id);
    library.collections.add(first.id, sampleVideo.video_id);
    library.collections.add(second.id, sampleVideo.video_id);
    expect(library.collections.videos(first.id)).toHaveLength(1);
    library.collections.remove(first.id, sampleVideo.video_id);
    expect(library.collections.videos(first.id)).toEqual([]);
    expect(library.collections.videos(second.id)).toHaveLength(1);
    expect(library.videos.list()).toHaveLength(1);
    library.videos.markDeleted(sampleVideo.video_id);
    expect(library.collections.videos(second.id)).toEqual([]);
  });
  it("should publish distinct RSS feeds with shared audio and stable GUIDs", async () => {
    const audioPath = join(library.directory, "audio.mp3");
    await Bun.write(audioPath, "test audio");
    library.videos.create({ ...sampleVideo, video_path: audioPath });
    const first = library.collections.create("Интервью & разговоры");
    const empty = library.collections.create("Empty");
    library.collections.add(first.id, sampleVideo.video_id);
    const uploaded: string[] = [];
    const publish = createFeedPublisher(library.collections, generateFeed, {
      baseUrl: "https://feed.test",
      rssFilePath: join(library.directory, "rss.xml"),
      storage: {
        ...createLocalStorage(),
        async uploadRss(_path, key) {
          uploaded.push(key ?? "rss.xml");
        },
      },
    });
    await publish(library.videos.list());
    const mainXml = await Bun.file(join(library.directory, "rss.xml")).text();
    const collectionXml = await Bun.file(join(library.directory, "feeds", `${first.id}.xml`)).text();
    const emptyXml = await Bun.file(join(library.directory, "feeds", `${empty.id}.xml`)).text();
    expect(mainXml).toContain(sampleVideo.video_id);
    expect(collectionXml).toContain("<title><![CDATA[Интервью & разговоры]]></title>");
    expect(collectionXml).toContain(`https://feed.test/feeds/${first.id}.xml`);
    expect(collectionXml).toContain(`https://feed.test/files/${sampleVideo.video_id}.mp3`);
    expect(collectionXml.match(/<guid[^>]*>.*?<\/guid>/)?.[0]).toBe(mainXml.match(/<guid[^>]*>.*?<\/guid>/)?.[0]);
    expect(emptyXml).not.toContain("<item>");
    expect(uploaded.toSorted()).toEqual(["rss.xml", `feeds/${first.id}.xml`, `feeds/${empty.id}.xml`].toSorted());
  });
  it("should attach a downloaded episode then retry publication without downloading it again", async () => {
    const collection = library.collections.create("Interviews");
    const job = library.jobs.enqueue({ kind: "download", videoId: sampleVideo.video_id, collectionId: collection.id });
    let downloads = 0;
    let publications = 0;
    const worker = createJobWorker({
      ...library,
      retryDelayMs: 0,
      log: { error() {} },
      async downloadVideo() {
        if (library.videos.exists(sampleVideo.video_id)) {
          return { status: "already-published" };
        }
        downloads += 1;
        library.videos.create(sampleVideo);
        return { status: "published" };
      },
      async publish() {
        publications += 1;
        if (publications === 1) {
          throw new Error("S3 unavailable");
        }
      },
    });
    await worker.runOnce();
    expect(library.jobs.get(job.id)?.status).toBe("queued");
    await worker.runOnce();
    expect(library.jobs.get(job.id)?.status).toBe("completed");
    expect(downloads).toBe(1);
    expect(publications).toBe(2);
    expect(library.collections.videos(collection.id)).toHaveLength(1);
  });
});
