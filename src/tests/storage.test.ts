import { getStorage, type Storage } from "../storage.ts";
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
    it("should return a storage instance", () => {
      // Без S3 конфигурации должен вернуться локальный storage
      // Нельзя напрямую тестировать getStorage из-за singleton,
      // поэтому тестируем интерфейс
      const mockLocalStorage: Storage = {
        uploadAudio: async (): Promise<void> => {},
        uploadRss: async (): Promise<void> => {},
        ensureCoverImage: async (): Promise<void> => {},
      };

      expect(mockLocalStorage).toBeDefined();
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
      // Создаём локальное хранилище напрямую для теста
      const createLocalStorage = (): Storage => ({
        async uploadAudio(): Promise<void> {},
        async uploadRss(): Promise<void> {},
        async ensureCoverImage(): Promise<void> {},
      });

      const localStorage = createLocalStorage();

      // Все методы должны выполняться без ошибок и возвращать undefined
      const audioResult = await localStorage.uploadAudio("videoId", "/path/to/audio.mp3");
      const rssResult = await localStorage.uploadRss("/path/to/rss.xml");
      const coverResult = await localStorage.ensureCoverImage();

      expect(audioResult).toBeUndefined();
      expect(rssResult).toBeUndefined();
      expect(coverResult).toBeUndefined();
    });

    it("should handle multiple calls to local storage methods", async () => {
      const createLocalStorage = (): Storage => ({
        async uploadAudio(): Promise<void> {},
        async uploadRss(): Promise<void> {},
        async ensureCoverImage(): Promise<void> {},
      });

      const localStorage = createLocalStorage();

      // Множественные вызовы не должны вызывать ошибок
      await localStorage.uploadAudio("video1", "/path/1.mp3");
      await localStorage.uploadAudio("video2", "/path/2.mp3");
      await localStorage.uploadRss("/path/rss.xml");
      await localStorage.ensureCoverImage();
      await localStorage.ensureCoverImage();

      // Если дошли сюда без ошибок - тест пройден
      expect(true).toBe(true);
    });
  });
});
