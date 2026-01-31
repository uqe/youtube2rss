import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  getBotToken,
  getDbFileName,
  getFilesDir,
  getLogLevel,
  getPort,
  getRequiredBotToken,
  getRequiredServerUrl,
  getRssFilePath,
  getS3Config,
  getServerUrl,
  getTelegramWhitelist,
  isS3Configured,
  isTestEnv,
  requireEnv,
} from "../config.ts";

describe("config tests", () => {
  // Сохраняем оригинальные значения переменных окружения
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Сохраняем оригинальные значения
    originalEnv.IS_TEST = Bun.env.IS_TEST;
    originalEnv.SERVER_URL = Bun.env.SERVER_URL;
    originalEnv.S3_ENDPOINT = Bun.env.S3_ENDPOINT;
    originalEnv.S3_BUCKET = Bun.env.S3_BUCKET;
    originalEnv.S3_ACCESS_KEY = Bun.env.S3_ACCESS_KEY;
    originalEnv.S3_SECRET_KEY = Bun.env.S3_SECRET_KEY;
    originalEnv.TELEGRAM_BOT_TOKEN = Bun.env.TELEGRAM_BOT_TOKEN;
    originalEnv.PORT = Bun.env.PORT;
    originalEnv.LOG_LEVEL = Bun.env.LOG_LEVEL;
    originalEnv.TELEGRAM_WHITELIST = Bun.env.TELEGRAM_WHITELIST;
  });

  afterEach(() => {
    // Восстанавливаем оригинальные значения
    Bun.env.IS_TEST = originalEnv.IS_TEST;
    Bun.env.SERVER_URL = originalEnv.SERVER_URL;
    Bun.env.S3_ENDPOINT = originalEnv.S3_ENDPOINT;
    Bun.env.S3_BUCKET = originalEnv.S3_BUCKET;
    Bun.env.S3_ACCESS_KEY = originalEnv.S3_ACCESS_KEY;
    Bun.env.S3_SECRET_KEY = originalEnv.S3_SECRET_KEY;
    Bun.env.TELEGRAM_BOT_TOKEN = originalEnv.TELEGRAM_BOT_TOKEN;
    Bun.env.PORT = originalEnv.PORT;
    Bun.env.LOG_LEVEL = originalEnv.LOG_LEVEL;
    Bun.env.TELEGRAM_WHITELIST = originalEnv.TELEGRAM_WHITELIST;
  });

  describe("isTestEnv", () => {
    it('should return true when IS_TEST is "true"', () => {
      Bun.env.IS_TEST = "true";
      expect(isTestEnv()).toBe(true);
    });

    it('should return false when IS_TEST is not "true"', () => {
      Bun.env.IS_TEST = "false";
      expect(isTestEnv()).toBe(false);
    });

    it("should return false when IS_TEST is undefined", () => {
      Bun.env.IS_TEST = undefined;
      expect(isTestEnv()).toBe(false);
    });

    it("should return false when IS_TEST is empty string", () => {
      Bun.env.IS_TEST = "";
      expect(isTestEnv()).toBe(false);
    });
  });

  describe("getServerUrl", () => {
    it("should return test URL when in test environment", () => {
      Bun.env.IS_TEST = "true";
      expect(getServerUrl()).toBe("https://test.com");
    });

    it("should return SERVER_URL when not in test environment", () => {
      Bun.env.IS_TEST = "false";
      Bun.env.SERVER_URL = "https://production.example.com";
      expect(getServerUrl()).toBe("https://production.example.com");
    });
  });

  describe("getRssFilePath", () => {
    it("should return test RSS path when in test environment", () => {
      Bun.env.IS_TEST = "true";
      expect(getRssFilePath()).toBe("./public/rss.test.xml");
    });

    it("should return production RSS path when not in test environment", () => {
      Bun.env.IS_TEST = "false";
      expect(getRssFilePath()).toBe("./public/rss.xml");
    });
  });

  describe("getFilesDir", () => {
    it("should return test directory when in test environment", () => {
      Bun.env.IS_TEST = "true";
      expect(getFilesDir()).toBe("./src/tests/data");
    });

    it("should return production directory when not in test environment", () => {
      Bun.env.IS_TEST = "false";
      expect(getFilesDir()).toBe("./public/files");
    });
  });

  describe("getDbFileName", () => {
    it("should return test database name when in test environment", () => {
      Bun.env.IS_TEST = "true";
      expect(getDbFileName()).toBe("youtube2rss.test.db");
    });

    it("should return production database name when not in test environment", () => {
      Bun.env.IS_TEST = "false";
      expect(getDbFileName()).toBe("youtube2rss.db");
    });
  });

  describe("getS3Config", () => {
    it("should return S3 configuration from environment variables", () => {
      Bun.env.S3_ENDPOINT = "https://s3.example.com";
      Bun.env.S3_BUCKET = "my-bucket";
      Bun.env.S3_ACCESS_KEY = "access-key";
      Bun.env.S3_SECRET_KEY = "secret-key";

      const config = getS3Config();

      expect(config).toEqual({
        endpoint: "https://s3.example.com",
        bucket: "my-bucket",
        accessKey: "access-key",
        secretKey: "secret-key",
      });
    });

    it("should return undefined values when environment variables are not set", () => {
      Bun.env.S3_ENDPOINT = undefined;
      Bun.env.S3_BUCKET = undefined;
      Bun.env.S3_ACCESS_KEY = undefined;
      Bun.env.S3_SECRET_KEY = undefined;

      const config = getS3Config();

      expect(config.endpoint).toBeUndefined();
      expect(config.bucket).toBeUndefined();
      expect(config.accessKey).toBeUndefined();
      expect(config.secretKey).toBeUndefined();
    });
  });

  describe("isS3Configured", () => {
    it("should return true when all S3 variables are set", () => {
      Bun.env.S3_ENDPOINT = "https://s3.example.com";
      Bun.env.S3_BUCKET = "my-bucket";
      Bun.env.S3_ACCESS_KEY = "access-key";
      Bun.env.S3_SECRET_KEY = "secret-key";

      expect(isS3Configured()).toBe(true);
    });

    it("should return false when S3_ENDPOINT is missing", () => {
      Bun.env.S3_ENDPOINT = undefined;
      Bun.env.S3_BUCKET = "my-bucket";
      Bun.env.S3_ACCESS_KEY = "access-key";
      Bun.env.S3_SECRET_KEY = "secret-key";

      expect(isS3Configured()).toBe(false);
    });

    it("should return false when S3_BUCKET is missing", () => {
      Bun.env.S3_ENDPOINT = "https://s3.example.com";
      Bun.env.S3_BUCKET = undefined;
      Bun.env.S3_ACCESS_KEY = "access-key";
      Bun.env.S3_SECRET_KEY = "secret-key";

      expect(isS3Configured()).toBe(false);
    });

    it("should return false when S3_ACCESS_KEY is missing", () => {
      Bun.env.S3_ENDPOINT = "https://s3.example.com";
      Bun.env.S3_BUCKET = "my-bucket";
      Bun.env.S3_ACCESS_KEY = undefined;
      Bun.env.S3_SECRET_KEY = "secret-key";

      expect(isS3Configured()).toBe(false);
    });

    it("should return false when S3_SECRET_KEY is missing", () => {
      Bun.env.S3_ENDPOINT = "https://s3.example.com";
      Bun.env.S3_BUCKET = "my-bucket";
      Bun.env.S3_ACCESS_KEY = "access-key";
      Bun.env.S3_SECRET_KEY = undefined;

      expect(isS3Configured()).toBe(false);
    });

    it("should return false when S3_ENDPOINT is empty string", () => {
      Bun.env.S3_ENDPOINT = "";
      Bun.env.S3_BUCKET = "my-bucket";
      Bun.env.S3_ACCESS_KEY = "access-key";
      Bun.env.S3_SECRET_KEY = "secret-key";

      expect(isS3Configured()).toBe(false);
    });
  });

  describe("getBotToken", () => {
    it("should return TELEGRAM_BOT_TOKEN value", () => {
      Bun.env.TELEGRAM_BOT_TOKEN = "my-bot-token";
      expect(getBotToken()).toBe("my-bot-token");
    });

    it("should return undefined when TELEGRAM_BOT_TOKEN is not set", () => {
      Bun.env.TELEGRAM_BOT_TOKEN = undefined;
      expect(getBotToken()).toBeUndefined();
    });
  });

  describe("requireEnv", () => {
    it("should return value when environment variable is set", () => {
      Bun.env.TEST_VAR = "test-value";
      expect(requireEnv("TEST_VAR")).toBe("test-value");
      delete Bun.env.TEST_VAR;
    });

    it("should throw error when environment variable is not set", () => {
      Bun.env.MISSING_VAR = undefined;
      expect(() => requireEnv("MISSING_VAR")).toThrow("MISSING_VAR is missing");
    });

    it("should throw error when environment variable is empty string", () => {
      Bun.env.EMPTY_VAR = "";
      expect(() => requireEnv("EMPTY_VAR")).toThrow("EMPTY_VAR is missing");
    });
  });

  describe("getRequiredServerUrl", () => {
    it("should return SERVER_URL when set", () => {
      Bun.env.SERVER_URL = "https://example.com";
      expect(getRequiredServerUrl()).toBe("https://example.com");
    });

    it("should throw error when SERVER_URL is not set", () => {
      Bun.env.SERVER_URL = undefined;
      expect(() => getRequiredServerUrl()).toThrow("SERVER_URL is missing");
    });
  });

  describe("getRequiredBotToken", () => {
    it("should return TELEGRAM_BOT_TOKEN when set", () => {
      Bun.env.TELEGRAM_BOT_TOKEN = "bot-token-123";
      expect(getRequiredBotToken()).toBe("bot-token-123");
    });

    it("should throw error when TELEGRAM_BOT_TOKEN is not set", () => {
      Bun.env.TELEGRAM_BOT_TOKEN = undefined;
      expect(() => getRequiredBotToken()).toThrow("TELEGRAM_BOT_TOKEN is missing");
    });
  });

  describe("getPort", () => {
    it("should return PORT value as number", () => {
      Bun.env.PORT = "8080";
      expect(getPort()).toBe(8080);
    });

    it("should return 3000 as default when PORT is not set", () => {
      Bun.env.PORT = undefined;
      expect(getPort()).toBe(3000);
    });

    it("should handle invalid PORT value", () => {
      Bun.env.PORT = "invalid";
      expect(getPort()).toBeNaN();
    });
  });

  describe("getLogLevel", () => {
    it("should return LOG_LEVEL value", () => {
      Bun.env.LOG_LEVEL = "debug";
      expect(getLogLevel()).toBe("debug");
    });

    it('should return "info" as default when LOG_LEVEL is not set', () => {
      Bun.env.LOG_LEVEL = undefined;
      expect(getLogLevel()).toBe("info");
    });
  });

  describe("getTelegramWhitelist", () => {
    it("should return array of user IDs from TELEGRAM_WHITELIST", () => {
      Bun.env.TELEGRAM_WHITELIST = "123456,789012,345678";
      expect(getTelegramWhitelist()).toEqual([123456, 789012, 345678]);
    });

    it("should handle whitespace in TELEGRAM_WHITELIST", () => {
      Bun.env.TELEGRAM_WHITELIST = "123456 , 789012 , 345678";
      expect(getTelegramWhitelist()).toEqual([123456, 789012, 345678]);
    });

    it("should filter out invalid numbers", () => {
      Bun.env.TELEGRAM_WHITELIST = "123456,invalid,789012";
      expect(getTelegramWhitelist()).toEqual([123456, 789012]);
    });

    it("should throw error when TELEGRAM_WHITELIST is not set", () => {
      Bun.env.TELEGRAM_WHITELIST = undefined;
      expect(() => getTelegramWhitelist()).toThrow(
        "TELEGRAM_WHITELIST environment variable must be set with at least one valid Telegram user ID",
      );
    });

    it("should throw error when TELEGRAM_WHITELIST is empty", () => {
      Bun.env.TELEGRAM_WHITELIST = "";
      expect(() => getTelegramWhitelist()).toThrow(
        "TELEGRAM_WHITELIST environment variable must be set with at least one valid Telegram user ID",
      );
    });

    it("should throw error when TELEGRAM_WHITELIST contains only invalid values", () => {
      Bun.env.TELEGRAM_WHITELIST = "invalid,abc,def";
      expect(() => getTelegramWhitelist()).toThrow(
        "TELEGRAM_WHITELIST environment variable must be set with at least one valid Telegram user ID",
      );
    });

    it("should handle single user ID", () => {
      Bun.env.TELEGRAM_WHITELIST = "123456";
      expect(getTelegramWhitelist()).toEqual([123456]);
    });
  });
});
