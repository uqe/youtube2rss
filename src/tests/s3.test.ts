import { createS3Storage } from "../s3.ts";
import { describe, expect, it } from "bun:test";

const createClient = ({ coverExists = false, failWrite = false } = {}) => {
  const writes: string[] = [];
  const writeTypes: Array<string | undefined> = [];
  const existsChecks: string[] = [];
  const deletes: string[] = [];

  return {
    writes,
    writeTypes,
    existsChecks,
    deletes,
    client: {
      async write(path: string, _file: Blob, options?: { type?: string }): Promise<void> {
        if (failWrite) {
          throw new Error("write failed");
        }
        writes.push(path);
        writeTypes.push(options?.type);
      },
      async exists(path: string): Promise<boolean> {
        existsChecks.push(path);
        return coverExists;
      },
      async size(): Promise<number> {
        return 123;
      },
      async delete(path: string): Promise<void> {
        deletes.push(path);
      },
    },
  };
};

const silentLogger = {
  error(): void {},
};

describe("s3 storage tests", () => {
  it("should throw when S3 is not configured", () => {
    expect(() => createS3Storage({ config: null, log: silentLogger })).toThrow("S3 is not configured");
  });

  it("should upload episode assets and RSS to expected keys", async () => {
    const { client, writes, writeTypes } = createClient();
    const storage = createS3Storage({
      client,
      log: silentLogger,
    });

    await storage.uploadAudio("video123", "/tmp/video.mp3");
    await storage.uploadArtwork("video123", "/tmp/video.jpg");
    await storage.uploadChapters("video123", "/tmp/video.json");
    await storage.uploadRss("/tmp/rss.xml");

    expect(writes).toEqual(["files/video123.mp3", "covers/video123.jpg", "chapters/video123.json", "rss.xml"]);
    expect(writeTypes).toEqual([undefined, undefined, "application/json+chapters", undefined]);
  });

  it("should not upload cover image when it already exists", async () => {
    const { client, writes, existsChecks } = createClient({ coverExists: true });
    const storage = createS3Storage({
      client,
      log: silentLogger,
    });

    await storage.ensureCoverImage();

    expect(existsChecks).toEqual(["cover.jpg"]);
    expect(writes).toEqual([]);
  });

  it("should upload cover image when it is missing", async () => {
    const { client, writes, existsChecks } = createClient({ coverExists: false });
    const storage = createS3Storage({
      client,
      coverImagePath: "/tmp/cover.jpg",
      log: silentLogger,
    });

    await storage.ensureCoverImage();

    expect(existsChecks).toEqual(["cover.jpg"]);
    expect(writes).toEqual(["cover.jpg"]);
  });

  it("should rethrow upload errors", async () => {
    const { client } = createClient({ failWrite: true });
    const storage = createS3Storage({
      client,
      log: silentLogger,
    });

    await expect(storage.uploadRss("/tmp/rss.xml")).rejects.toThrow("write failed");
  });

  it("should resolve metadata from S3 when the local audio file is absent", async () => {
    const { client } = createClient({ coverExists: true });
    const storage = createS3Storage({ client, log: silentLogger });

    const metadata = await storage.getAudioMetadata("video123", "/tmp/youtube2rss-missing-audio.mp3");

    expect(metadata).toEqual({ exists: true, size: 123 });
  });

  it("should delete episode assets from S3 and the local filesystem", async () => {
    const audioPath = `${import.meta.dir}/data/s3-delete.mp3`;
    const artworkPath = `${import.meta.dir}/data/s3-delete.jpg`;
    const chaptersPath = `${import.meta.dir}/data/s3-delete.json`;
    await Bun.write(audioPath, "audio");
    await Bun.write(artworkPath, "artwork");
    await Bun.write(chaptersPath, "chapters");
    const { client, deletes } = createClient();
    const storage = createS3Storage({ client, log: silentLogger });

    await storage.deleteEpisodeAssets("video123", audioPath, artworkPath, chaptersPath);

    expect(deletes).toEqual(["files/video123.mp3", "covers/video123.jpg", "chapters/video123.json"]);
    expect(await Bun.file(audioPath).exists()).toBe(false);
    expect(await Bun.file(artworkPath).exists()).toBe(false);
    expect(await Bun.file(chaptersPath).exists()).toBe(false);
  });
});
