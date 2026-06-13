import { createS3Storage } from "../s3.ts";
import { describe, expect, it } from "bun:test";

const createClient = ({ coverExists = false, failWrite = false } = {}) => {
  const writes: string[] = [];
  const existsChecks: string[] = [];

  return {
    writes,
    existsChecks,
    client: {
      async write(path: string): Promise<void> {
        if (failWrite) {
          throw new Error("write failed");
        }
        writes.push(path);
      },
      async exists(path: string): Promise<boolean> {
        existsChecks.push(path);
        return coverExists;
      },
    },
  };
};

const silentLogger = {
  error(): void {},
};

describe("s3 storage tests", () => {
  it("should throw when S3 is not configured", () => {
    expect(() =>
      createS3Storage({
        isConfigured: () => false,
        log: silentLogger,
      })
    ).toThrow("S3 is not properly configured");
  });

  it("should upload audio and RSS to expected keys", async () => {
    const { client, writes } = createClient();
    const storage = createS3Storage({
      client,
      isConfigured: () => true,
      log: silentLogger,
    });

    await storage.uploadAudio("video123", "/tmp/video.mp3");
    await storage.uploadRss("/tmp/rss.xml");

    expect(writes).toEqual(["files/video123.mp3", "rss.xml"]);
  });

  it("should not upload cover image when it already exists", async () => {
    const { client, writes, existsChecks } = createClient({ coverExists: true });
    const storage = createS3Storage({
      client,
      isConfigured: () => true,
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
      isConfigured: () => true,
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
      isConfigured: () => true,
      log: silentLogger,
    });

    await expect(storage.uploadRss("/tmp/rss.xml")).rejects.toThrow("write failed");
  });
});
