import { afterEach, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";

import { createS3Storage } from "../s3.ts";

interface ClientOptions {
  existingPaths?: string[];
  failDeletes?: string[];
  failExists?: string[];
  failWrite?: boolean;
  objectSizes?: Record<string, number>;
}

const createClient = ({
  existingPaths = [],
  failDeletes = [],
  failExists = [],
  failWrite = false,
  objectSizes = {},
}: ClientOptions = {}) => {
  const writes: string[] = [];
  const writeTypes: Array<string | undefined> = [];
  const existsChecks: string[] = [];
  const sizeChecks: string[] = [];
  const deletes: string[] = [];
  const existingPathSet = new Set(existingPaths);
  const failedDeleteSet = new Set(failDeletes);
  const failedExistsSet = new Set(failExists);

  return {
    writes,
    writeTypes,
    existsChecks,
    sizeChecks,
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
        if (failedExistsSet.has(path)) {
          throw new Error(`exists failed for ${path}`);
        }
        return existingPathSet.has(path);
      },
      async size(path: string): Promise<number> {
        sizeChecks.push(path);
        return objectSizes[path] ?? 123;
      },
      async delete(path: string): Promise<void> {
        deletes.push(path);
        if (failedDeleteSet.has(path)) {
          throw new Error(`delete failed for ${path}`);
        }
      },
    },
  };
};

const silentLogger = {
  error(): void {},
};

const testDirectory = `${import.meta.dir}/data/s3-storage`;

afterEach(async () => {
  await rm(testDirectory, { force: true, recursive: true });
});

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
    const { client, writes, existsChecks } = createClient({ existingPaths: ["cover.jpg"] });
    const storage = createS3Storage({
      client,
      log: silentLogger,
    });

    await storage.ensureCoverImage();

    expect(existsChecks).toEqual(["cover.jpg"]);
    expect(writes).toEqual([]);
  });

  it("should upload cover image when it is missing", async () => {
    const { client, writes, existsChecks } = createClient();
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

  it("should log audio upload errors with the video ID", async () => {
    const errors: string[] = [];
    const { client } = createClient({ failWrite: true });
    const storage = createS3Storage({
      client,
      log: { error: (message) => errors.push(message) },
    });

    await expect(storage.uploadAudio("video123", "/tmp/audio.mp3")).rejects.toThrow("write failed");
    expect(errors).toEqual(["Error putting file on S3 for video video123: Error: write failed"]);
  });

  it("should log artwork upload errors with the video ID", async () => {
    const errors: string[] = [];
    const { client } = createClient({ failWrite: true });
    const storage = createS3Storage({
      client,
      log: { error: (message) => errors.push(message) },
    });

    await expect(storage.uploadArtwork("video123", "/tmp/artwork.jpg")).rejects.toThrow("write failed");
    expect(errors).toEqual(["Error uploading artwork to S3 for video video123: Error: write failed"]);
  });

  it("should log chapter upload errors with the video ID", async () => {
    const errors: string[] = [];
    const { client } = createClient({ failWrite: true });
    const storage = createS3Storage({
      client,
      log: { error: (message) => errors.push(message) },
    });

    await expect(storage.uploadChapters("video123", "/tmp/chapters.json")).rejects.toThrow("write failed");
    expect(errors).toEqual(["Error uploading chapters to S3 for video video123: Error: write failed"]);
  });

  it("should log the RSS path when RSS upload fails", async () => {
    const errors: string[] = [];
    const { client } = createClient({ failWrite: true });
    const storage = createS3Storage({
      client,
      log: { error: (message) => errors.push(message) },
    });

    await expect(storage.uploadRss("/tmp/rss.xml")).rejects.toThrow("write failed");
    expect(errors).toEqual(["Error uploading RSS XML to S3 from /tmp/rss.xml: Error: write failed"]);
  });

  it("should log and rethrow cover existence check errors", async () => {
    const errors: string[] = [];
    const { client } = createClient({ failExists: ["cover.jpg"] });
    const storage = createS3Storage({
      client,
      log: { error: (message) => errors.push(message) },
    });

    await expect(storage.ensureCoverImage()).rejects.toThrow("exists failed for cover.jpg");
    expect(errors).toEqual(["Error ensuring cover image on S3: Error: exists failed for cover.jpg"]);
  });

  it("should prefer local audio metadata without checking S3", async () => {
    const audioPath = `${testDirectory}/local.mp3`;
    await Bun.write(audioPath, "local-audio");
    const { client, existsChecks, sizeChecks } = createClient({
      existingPaths: ["files/video123.mp3"],
    });
    const storage = createS3Storage({ client, log: silentLogger });

    await expect(storage.getAudioMetadata("video123", audioPath)).resolves.toEqual({
      exists: true,
      size: 11,
      filePath: audioPath,
    });
    expect(existsChecks).toEqual([]);
    expect(sizeChecks).toEqual([]);
  });

  it("should resolve metadata from S3 when the local audio file is absent", async () => {
    const { client, existsChecks, sizeChecks } = createClient({
      existingPaths: ["files/video123.mp3"],
      objectSizes: { "files/video123.mp3": 456 },
    });
    const storage = createS3Storage({ client, log: silentLogger });

    const metadata = await storage.getAudioMetadata("video123", "/tmp/youtube2rss-missing-audio.mp3");

    expect(metadata).toEqual({ exists: true, size: 456 });
    expect(existsChecks).toEqual(["files/video123.mp3"]);
    expect(sizeChecks).toEqual(["files/video123.mp3"]);
  });

  it("should report audio missing in both local and remote storage", async () => {
    const { client, existsChecks, sizeChecks } = createClient();
    const storage = createS3Storage({ client, log: silentLogger });

    await expect(storage.getAudioMetadata("missing", `${testDirectory}/missing.mp3`)).resolves.toEqual({
      exists: false,
    });
    expect(existsChecks).toEqual(["files/missing.mp3"]);
    expect(sizeChecks).toEqual([]);
  });

  it("should prefer local artwork without checking S3", async () => {
    const artworkPath = `${testDirectory}/local.jpg`;
    await Bun.write(artworkPath, "artwork");
    const { client, existsChecks } = createClient();
    const storage = createS3Storage({ client, log: silentLogger });

    await expect(storage.getArtworkMetadata("video123", artworkPath)).resolves.toEqual({ exists: true });
    expect(existsChecks).toEqual([]);
  });

  it("should resolve artwork metadata from S3 when the local file is absent", async () => {
    const { client, existsChecks } = createClient({ existingPaths: ["covers/video123.jpg"] });
    const storage = createS3Storage({ client, log: silentLogger });

    await expect(storage.getArtworkMetadata("video123", `${testDirectory}/missing.jpg`)).resolves.toEqual({
      exists: true,
    });
    expect(existsChecks).toEqual(["covers/video123.jpg"]);
  });

  it("should report missing artwork in both storage locations", async () => {
    const { client } = createClient();
    const storage = createS3Storage({ client, log: silentLogger });

    await expect(storage.getArtworkMetadata("video123", `${testDirectory}/missing.jpg`)).resolves.toEqual({
      exists: false,
    });
  });

  it("should prefer local chapters without checking S3", async () => {
    const chaptersPath = `${testDirectory}/local.json`;
    await Bun.write(chaptersPath, "{}");
    const { client, existsChecks } = createClient();
    const storage = createS3Storage({ client, log: silentLogger });

    await expect(storage.getChaptersMetadata("video123", chaptersPath)).resolves.toEqual({ exists: true });
    expect(existsChecks).toEqual([]);
  });

  it("should resolve chapter metadata from S3 when the local file is absent", async () => {
    const { client, existsChecks } = createClient({ existingPaths: ["chapters/video123.json"] });
    const storage = createS3Storage({ client, log: silentLogger });

    await expect(storage.getChaptersMetadata("video123", `${testDirectory}/missing.json`)).resolves.toEqual({
      exists: true,
    });
    expect(existsChecks).toEqual(["chapters/video123.json"]);
  });

  it("should report missing chapters in both storage locations", async () => {
    const { client } = createClient();
    const storage = createS3Storage({ client, log: silentLogger });

    await expect(storage.getChaptersMetadata("video123", `${testDirectory}/missing.json`)).resolves.toEqual({
      exists: false,
    });
  });

  it("should delete episode assets from S3 and the local filesystem", async () => {
    const audioPath = `${testDirectory}/s3-delete.mp3`;
    const artworkPath = `${testDirectory}/s3-delete.jpg`;
    const chaptersPath = `${testDirectory}/s3-delete.json`;
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

  it("should tolerate omitted and already missing local asset paths", async () => {
    const { client, deletes } = createClient();
    const storage = createS3Storage({ client, log: silentLogger });

    await expect(
      storage.deleteEpisodeAssets("video123", `${testDirectory}/missing.mp3`, null, undefined),
    ).resolves.toBeUndefined();
    expect(deletes).toEqual(["files/video123.mp3", "covers/video123.jpg", "chapters/video123.json"]);
  });

  it("should aggregate remote deletion failures after attempting every asset", async () => {
    const errors: string[] = [];
    const { client, deletes } = createClient({
      failDeletes: ["files/video123.mp3", "chapters/video123.json"],
    });
    const storage = createS3Storage({
      client,
      log: { error: (message) => errors.push(message) },
    });

    await expect(storage.deleteEpisodeAssets("video123", `${testDirectory}/missing.mp3`)).rejects.toThrow(
      "Failed to delete episode assets for video video123: Error: delete failed for files/video123.mp3; Error: delete failed for chapters/video123.json",
    );
    expect(deletes).toEqual(["files/video123.mp3", "covers/video123.jpg", "chapters/video123.json"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Failed to delete episode assets for video video123");
  });
});
