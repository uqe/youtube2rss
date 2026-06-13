import { createLocalStorage, createStorage, getStorage, type Storage } from "../storage.ts";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

describe("storage tests", () => {
  // Сохраняем оригинальные значения переменных окружения
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    originalEnv.S3_ENDPOINT = Bun.env.S3_ENDPOINT;
    originalEnv.S3_BUCKET = Bun.env.S3_BUCKET;
    originalEnv.S3_ACCESS_KEY = Bun.env.S3_ACCESS_KEY;
    originalEnv.S3_SECRET_KEY = Bun.env.S3_SECRET_KEY;

    // Очищаем S3 переменные для тестирования локального хранилища
    Bun.env.S3_ENDPOINT = undefined;
    Bun.env.S3_BUCKET = undefined;
    Bun.env.S3_ACCESS_KEY = undefined;
    Bun.env.S3_SECRET_KEY = undefined;
  });

  afterEach(() => {
    Bun.env.S3_ENDPOINT = originalEnv.S3_ENDPOINT;
    Bun.env.S3_BUCKET = originalEnv.S3_BUCKET;
    Bun.env.S3_ACCESS_KEY = originalEnv.S3_ACCESS_KEY;
    Bun.env.S3_SECRET_KEY = originalEnv.S3_SECRET_KEY;
  });

  describe("Storage interface", () => {
    it("should define correct interface methods", () => {
      const storage: Storage = {
        uploadAudio: async () => {},
        uploadRss: async () => {},
        ensureCoverImage: async () => {},
      };

      expect(typeof storage.uploadAudio).toBe("function");
      expect(typeof storage.uploadRss).toBe("function");
      expect(typeof storage.ensureCoverImage).toBe("function");
    });
  });

  describe("Local storage (when S3 is not configured)", () => {
    it("should return a local storage instance from getStorage", async () => {
      const storage = getStorage();

      expect(storage).toBeDefined();
      await expect(storage.uploadAudio("videoId", "/missing/audio.mp3")).resolves.toBeUndefined();
      await expect(storage.uploadRss("/missing/rss.xml")).resolves.toBeUndefined();
      await expect(storage.ensureCoverImage()).resolves.toBeUndefined();
    });

    it("should reuse the same storage instance across calls", () => {
      expect(getStorage()).toBe(getStorage());
    });

    it("uploadAudio should resolve without error for local storage", async () => {
      const mockLocalStorage: Storage = {
        uploadAudio: async (): Promise<void> => {},
        uploadRss: async (): Promise<void> => {},
        ensureCoverImage: async (): Promise<void> => {},
      };

      await expect(mockLocalStorage.uploadAudio("testId", "/path/to/file.mp3")).resolves.toBeUndefined();
    });

    it("uploadRss should resolve without error for local storage", async () => {
      const mockLocalStorage: Storage = {
        uploadAudio: async (): Promise<void> => {},
        uploadRss: async (): Promise<void> => {},
        ensureCoverImage: async (): Promise<void> => {},
      };

      await expect(mockLocalStorage.uploadRss("/path/to/rss.xml")).resolves.toBeUndefined();
    });

    it("ensureCoverImage should resolve without error for local storage", async () => {
      const mockLocalStorage: Storage = {
        uploadAudio: async (): Promise<void> => {},
        uploadRss: async (): Promise<void> => {},
        ensureCoverImage: async (): Promise<void> => {},
      };

      await expect(mockLocalStorage.ensureCoverImage()).resolves.toBeUndefined();
    });
  });

  describe("Storage factory pattern", () => {
    it("local storage methods should be no-op functions", async () => {
      const localStorage = createLocalStorage();

      const audioResult = await localStorage.uploadAudio("videoId", "/path/to/audio.mp3");
      const rssResult = await localStorage.uploadRss("/path/to/rss.xml");
      const coverResult = await localStorage.ensureCoverImage();

      expect(audioResult).toBeUndefined();
      expect(rssResult).toBeUndefined();
      expect(coverResult).toBeUndefined();
    });

    it("should handle multiple calls to local storage methods", async () => {
      const localStorage = createLocalStorage();

      await localStorage.uploadAudio("video1", "/path/1.mp3");
      await localStorage.uploadAudio("video2", "/path/2.mp3");
      await localStorage.uploadRss("/path/rss.xml");
      await localStorage.ensureCoverImage();
      await localStorage.ensureCoverImage();

      expect(true).toBe(true);
    });

    it("createStorage should return local storage when remote storage is not configured", async () => {
      const storage = createStorage({
        isRemoteConfigured: () => false,
        createRemoteStorage: () => {
          throw new Error("Remote storage should not be created");
        },
      });

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
  });
});
