import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { createLocalStorage, createStorage, getStorage, type Storage } from "../storage.ts";
import { restoreEnvironment } from "./environment.ts";

describe("storage tests", () => {
  // Сохраняем оригинальные значения переменных окружения
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    originalEnv.S3_ENDPOINT = Bun.env.S3_ENDPOINT;
    originalEnv.S3_BUCKET = Bun.env.S3_BUCKET;
    originalEnv.S3_ACCESS_KEY = Bun.env.S3_ACCESS_KEY;
    originalEnv.S3_SECRET_KEY = Bun.env.S3_SECRET_KEY;

    // Очищаем S3 переменные для тестирования локального хранилища
    delete Bun.env.S3_ENDPOINT;
    delete Bun.env.S3_BUCKET;
    delete Bun.env.S3_ACCESS_KEY;
    delete Bun.env.S3_SECRET_KEY;
  });

  afterEach(() => {
    restoreEnvironment(originalEnv);
  });

  describe("Local storage (when S3 is not configured)", () => {
    it("should return a local storage instance from getStorage", async () => {
      const storage = getStorage();

      expect(storage).toBeDefined();
      expect(storage.kind).toBe("local");
      await expect(storage.uploadAudio("videoId", "/missing/audio.mp3")).resolves.toBeUndefined();
      await expect(storage.uploadArtwork("videoId", "/missing/artwork.jpg")).resolves.toBeUndefined();
      await expect(storage.uploadChapters("videoId", "/missing/chapters.json")).resolves.toBeUndefined();
      await expect(storage.uploadRss("/missing/rss.xml")).resolves.toBeUndefined();
      await expect(storage.ensureCoverImage()).resolves.toBeUndefined();
    });

    it("should reuse the same storage instance across calls", () => {
      expect(getStorage()).toBe(getStorage());
    });

    it("should read local audio metadata without opening the file", async () => {
      const filePath = `${import.meta.dir}/data/storage-metadata.mp3`;
      await Bun.write(filePath, "audio");

      try {
        await expect(createLocalStorage().getAudioMetadata("videoId", filePath)).resolves.toEqual({
          exists: true,
          size: 5,
          filePath,
        });
      } finally {
        await Bun.file(filePath).delete();
      }
    });

    it("should report missing local audio", async () => {
      const filePath = `${import.meta.dir}/data/missing-storage-audio.mp3`;
      await expect(createLocalStorage().getAudioMetadata("videoId", filePath)).resolves.toEqual({
        exists: false,
      });
    });

    it("should report existing and missing local artwork", async () => {
      const filePath = `${import.meta.dir}/data/storage-artwork.jpg`;
      const missingPath = `${import.meta.dir}/data/missing-storage-artwork.jpg`;
      await Bun.write(filePath, "artwork");

      try {
        const storage = createLocalStorage();
        await expect(storage.getArtworkMetadata("videoId", filePath)).resolves.toEqual({ exists: true });
        await expect(storage.getArtworkMetadata("videoId", missingPath)).resolves.toEqual({ exists: false });
      } finally {
        await Bun.file(filePath).delete();
      }
    });

    it("should report existing and missing local chapter documents", async () => {
      const filePath = `${import.meta.dir}/data/storage-chapters.json`;
      const missingPath = `${import.meta.dir}/data/missing-storage-chapters.json`;
      await Bun.write(filePath, "{}");

      try {
        const storage = createLocalStorage();
        await expect(storage.getChaptersMetadata("videoId", filePath)).resolves.toEqual({ exists: true });
        await expect(storage.getChaptersMetadata("videoId", missingPath)).resolves.toEqual({ exists: false });
      } finally {
        await Bun.file(filePath).delete();
      }
    });

    it("should delete local episode assets idempotently", async () => {
      const audioPath = `${import.meta.dir}/data/storage-delete.mp3`;
      const artworkPath = `${import.meta.dir}/data/storage-delete.jpg`;
      const chaptersPath = `${import.meta.dir}/data/storage-delete.json`;
      await Bun.write(audioPath, "audio");
      await Bun.write(artworkPath, "artwork");
      await Bun.write(chaptersPath, "chapters");

      const storage = createLocalStorage();
      await storage.deleteEpisodeAssets("videoId", audioPath, artworkPath, chaptersPath);
      await storage.deleteEpisodeAssets("videoId", audioPath, artworkPath, chaptersPath);

      expect(await Bun.file(audioPath).exists()).toBe(false);
      expect(await Bun.file(artworkPath).exists()).toBe(false);
      expect(await Bun.file(chaptersPath).exists()).toBe(false);
    });

    it("should delete only the supplied local paths", async () => {
      const audioPath = `${import.meta.dir}/data/storage-audio-only.mp3`;
      await Bun.write(audioPath, "audio");

      await createLocalStorage().deleteEpisodeAssets("videoId", audioPath, null, undefined);

      expect(await Bun.file(audioPath).exists()).toBe(false);
    });
  });

  describe("Storage factory pattern", () => {
    it("local storage methods should be no-op functions", async () => {
      const localStorage = createLocalStorage();

      const audioResult = await localStorage.uploadAudio("videoId", "/path/to/audio.mp3");
      const artworkResult = await localStorage.uploadArtwork("videoId", "/path/to/artwork.jpg");
      const chaptersResult = await localStorage.uploadChapters("videoId", "/path/to/chapters.json");
      const rssResult = await localStorage.uploadRss("/path/to/rss.xml");
      const coverResult = await localStorage.ensureCoverImage();

      expect(audioResult).toBeUndefined();
      expect(artworkResult).toBeUndefined();
      expect(chaptersResult).toBeUndefined();
      expect(rssResult).toBeUndefined();
      expect(coverResult).toBeUndefined();
    });

    it("createStorage should return local storage when remote storage is not configured", async () => {
      let predicateCalls = 0;
      let remoteFactoryCalls = 0;
      const storage = createStorage({
        isRemoteConfigured: () => {
          predicateCalls += 1;
          return false;
        },
        createRemoteStorage: () => {
          remoteFactoryCalls += 1;
          throw new Error("Remote storage should not be created");
        },
      });

      expect(storage.kind).toBe("local");
      expect(predicateCalls).toBe(1);
      expect(remoteFactoryCalls).toBe(0);
      await expect(storage.uploadAudio("videoId", "/missing/audio.mp3")).resolves.toBeUndefined();
    });

    it("createStorage should return remote storage when remote storage is configured", () => {
      const remoteStorage = createLocalStorage();
      const storage = createStorage({
        isRemoteConfigured: () => true,
        createRemoteStorage: () => remoteStorage,
      });

      expect(storage).toBe(remoteStorage);
    });

    it("should invoke the remote factory exactly once", () => {
      let predicateCalls = 0;
      let factoryCalls = 0;
      const remoteStorage: Storage = { ...createLocalStorage(), kind: "remote" };

      const storage = createStorage({
        isRemoteConfigured: () => {
          predicateCalls += 1;
          return true;
        },
        createRemoteStorage: () => {
          factoryCalls += 1;
          return remoteStorage;
        },
      });

      expect(storage).toBe(remoteStorage);
      expect(storage.kind).toBe("remote");
      expect(predicateCalls).toBe(1);
      expect(factoryCalls).toBe(1);
    });

    it("should propagate remote storage construction failures", () => {
      expect(() =>
        createStorage({
          isRemoteConfigured: () => true,
          createRemoteStorage: () => {
            throw new Error("remote factory failed");
          },
        }),
      ).toThrow("remote factory failed");
    });
  });
});
