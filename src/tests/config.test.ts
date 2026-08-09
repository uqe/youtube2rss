import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  getAdminPassword,
  getBotToken,
  getCoversDir,
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
  getYoutubeDlAuthOptions,
  getYoutubeDownloadTimeoutMs,
  isS3Configured,
  isTestEnv,
  loadBotAppConfig,
  loadServerAppConfig,
  normalizeServerUrl,
  parseInteger,
  parseIntegerList,
  requireEnv,
} from "../config.ts";

describe("config tests", () => {
  const environmentVariableNames = [
    "IS_TEST",
    "SERVER_URL",
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY",
    "S3_SECRET_KEY",
    "TELEGRAM_BOT_TOKEN",
    "PORT",
    "LOG_LEVEL",
    "ADMIN_PASSWORD",
    "TELEGRAM_WHITELIST",
    "YOUTUBE_COOKIES_FROM_BROWSER",
    "YOUTUBE_COOKIES_PATH",
    "YOUTUBE_DOWNLOAD_TIMEOUT_MS",
    "YOUTUBE_EXTRACTOR_ARGS",
  ] as const;
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const name of environmentVariableNames) {
      originalEnv[name] = Bun.env[name];
      Bun.env[name] = undefined;
    }

    Bun.env.IS_TEST = "true";
  });

  afterEach(() => {
    for (const name of environmentVariableNames) {
      Bun.env[name] = originalEnv[name];
    }
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

  describe("getCoversDir", () => {
    it("should return test artwork directory when in test environment", () => {
      Bun.env.IS_TEST = "true";
      expect(getCoversDir()).toBe("./src/tests/data/covers");
    });

    it("should return public artwork directory outside the test environment", () => {
      Bun.env.IS_TEST = "false";
      expect(getCoversDir()).toBe("./public/covers");
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
    it("should return false when no S3 variables are set", () => {
      expect(isS3Configured()).toBe(false);
    });

    it("should return true when all S3 variables are set", () => {
      Bun.env.S3_ENDPOINT = "https://s3.example.com";
      Bun.env.S3_BUCKET = "my-bucket";
      Bun.env.S3_ACCESS_KEY = "access-key";
      Bun.env.S3_SECRET_KEY = "secret-key";

      expect(isS3Configured()).toBe(true);
    });

    it("should reject configuration when S3_ENDPOINT is missing", () => {
      Bun.env.S3_ENDPOINT = undefined;
      Bun.env.S3_BUCKET = "my-bucket";
      Bun.env.S3_ACCESS_KEY = "access-key";
      Bun.env.S3_SECRET_KEY = "secret-key";

      expect(() => isS3Configured()).toThrow("S3_ENDPOINT");
    });

    it("should reject configuration when S3_BUCKET is missing", () => {
      Bun.env.S3_ENDPOINT = "https://s3.example.com";
      Bun.env.S3_BUCKET = undefined;
      Bun.env.S3_ACCESS_KEY = "access-key";
      Bun.env.S3_SECRET_KEY = "secret-key";

      expect(() => isS3Configured()).toThrow("S3_BUCKET");
    });

    it("should reject configuration when S3_ACCESS_KEY is missing", () => {
      Bun.env.S3_ENDPOINT = "https://s3.example.com";
      Bun.env.S3_BUCKET = "my-bucket";
      Bun.env.S3_ACCESS_KEY = undefined;
      Bun.env.S3_SECRET_KEY = "secret-key";

      expect(() => isS3Configured()).toThrow("S3_ACCESS_KEY");
    });

    it("should reject configuration when S3_SECRET_KEY is missing", () => {
      Bun.env.S3_ENDPOINT = "https://s3.example.com";
      Bun.env.S3_BUCKET = "my-bucket";
      Bun.env.S3_ACCESS_KEY = "access-key";
      Bun.env.S3_SECRET_KEY = undefined;

      expect(() => isS3Configured()).toThrow("S3_SECRET_KEY");
    });

    it("should reject configuration when S3_ENDPOINT is empty", () => {
      Bun.env.S3_ENDPOINT = "";
      Bun.env.S3_BUCKET = "my-bucket";
      Bun.env.S3_ACCESS_KEY = "access-key";
      Bun.env.S3_SECRET_KEY = "secret-key";

      expect(() => isS3Configured()).toThrow("S3_ENDPOINT");
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
      Bun.env.IS_TEST = "false";
      Bun.env.SERVER_URL = "https://example.com";
      expect(getRequiredServerUrl()).toBe("https://example.com");
    });

    it("should throw error when SERVER_URL is not set", () => {
      Bun.env.IS_TEST = "false";
      Bun.env.SERVER_URL = undefined;
      expect(() => getRequiredServerUrl()).toThrow("SERVER_URL is missing");
    });

    it("should remove trailing slashes", () => {
      Bun.env.IS_TEST = "false";
      Bun.env.SERVER_URL = "https://example.com///";
      expect(getRequiredServerUrl()).toBe("https://example.com");
    });
  });

  describe("normalizeServerUrl", () => {
    it("should reject relative URLs", () => {
      expect(() => normalizeServerUrl("example.com/rss")).toThrow("SERVER_URL must be a valid absolute URL");
    });

    it("should reject unsupported protocols", () => {
      expect(() => normalizeServerUrl("ftp://example.com")).toThrow("SERVER_URL must use http or https");
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

  describe("parseInteger", () => {
    it("should parse signed integer strings", () => {
      expect(parseInteger("123")).toBe(123);
      expect(parseInteger(" -123 ")).toBe(-123);
    });

    it("should reject partial integer strings", () => {
      expect(parseInteger("123abc")).toBeNaN();
      expect(parseInteger("12.3")).toBeNaN();
      expect(parseInteger("")).toBeNaN();
    });
  });

  describe("parseIntegerList", () => {
    it("should parse comma-separated integers and skip invalid entries", () => {
      expect(parseIntegerList("123, invalid, 456")).toEqual([123, 456]);
    });

    it("should reject partial integer entries", () => {
      expect(parseIntegerList("123abc,456")).toEqual([456]);
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

    it("should reject invalid PORT value", () => {
      Bun.env.PORT = "invalid";
      expect(() => getPort()).toThrow("PORT must be an integer between 0 and 65535");
    });

    it("should parse PORT with surrounding whitespace", () => {
      Bun.env.PORT = " 8080 ";
      expect(getPort()).toBe(8080);
    });

    it("should reject PORT values with trailing text", () => {
      Bun.env.PORT = "8080abc";
      expect(() => getPort()).toThrow("PORT must be an integer between 0 and 65535");
    });

    it("should reject PORT values outside the TCP range", () => {
      expect(() => getPort({ PORT: "-1" })).toThrow("PORT must be an integer between 0 and 65535");
      expect(() => getPort({ PORT: "65536" })).toThrow("PORT must be an integer between 0 and 65535");
    });
  });

  describe("getYoutubeDownloadTimeoutMs", () => {
    it("should return default timeout when YOUTUBE_DOWNLOAD_TIMEOUT_MS is not set", () => {
      Bun.env.YOUTUBE_DOWNLOAD_TIMEOUT_MS = undefined;
      expect(getYoutubeDownloadTimeoutMs()).toBe(1800000);
    });

    it("should return configured timeout", () => {
      Bun.env.YOUTUBE_DOWNLOAD_TIMEOUT_MS = "250000";
      expect(getYoutubeDownloadTimeoutMs()).toBe(250000);
    });

    it("should throw when YOUTUBE_DOWNLOAD_TIMEOUT_MS is invalid", () => {
      Bun.env.YOUTUBE_DOWNLOAD_TIMEOUT_MS = "invalid";
      expect(() => getYoutubeDownloadTimeoutMs()).toThrow("YOUTUBE_DOWNLOAD_TIMEOUT_MS must be a positive integer");
    });

    it("should throw when YOUTUBE_DOWNLOAD_TIMEOUT_MS is not positive", () => {
      Bun.env.YOUTUBE_DOWNLOAD_TIMEOUT_MS = "0";
      expect(() => getYoutubeDownloadTimeoutMs()).toThrow("YOUTUBE_DOWNLOAD_TIMEOUT_MS must be a positive integer");
    });
  });

  describe("getYoutubeDlAuthOptions", () => {
    it("should use cookies.txt by default", () => {
      Bun.env.YOUTUBE_COOKIES_FROM_BROWSER = undefined;
      Bun.env.YOUTUBE_COOKIES_PATH = undefined;
      Bun.env.YOUTUBE_EXTRACTOR_ARGS = undefined;

      expect(getYoutubeDlAuthOptions()).toEqual({ cookies: "./cookies.txt" });
    });

    it("should use configured cookies path", () => {
      Bun.env.YOUTUBE_COOKIES_FROM_BROWSER = undefined;
      Bun.env.YOUTUBE_COOKIES_PATH = "./private/cookies.txt";

      expect(getYoutubeDlAuthOptions()).toEqual({ cookies: "./private/cookies.txt" });
    });

    it("should prefer browser cookies and include extractor args", () => {
      Bun.env.YOUTUBE_COOKIES_FROM_BROWSER = "chrome";
      Bun.env.YOUTUBE_COOKIES_PATH = "./private/cookies.txt";
      Bun.env.YOUTUBE_EXTRACTOR_ARGS = "youtube:formats=missing_pot";

      expect(getYoutubeDlAuthOptions()).toEqual({
        cookiesFromBrowser: "chrome",
        extractorArgs: "youtube:formats=missing_pot",
      });
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

    it("should reject unsupported log levels", () => {
      expect(() => getLogLevel({ LOG_LEVEL: "verbose" })).toThrow("LOG_LEVEL must be one of: debug, info, warn, error");
    });
  });

  describe("getAdminPassword", () => {
    it("should trim the configured admin password", () => {
      expect(getAdminPassword({ ADMIN_PASSWORD: "  secret  " })).toBe("secret");
    });

    it("should keep the admin disabled when the password is missing", () => {
      expect(getAdminPassword({})).toBeUndefined();
    });
  });

  describe("typed startup configuration", () => {
    it("should load and normalize bot configuration in one pass", () => {
      const config = loadBotAppConfig({
        IS_TEST: "false",
        SERVER_URL: "https://example.com/",
        TELEGRAM_BOT_TOKEN: "bot-token",
        TELEGRAM_WHITELIST: "123,456",
        YOUTUBE_DOWNLOAD_TIMEOUT_MS: "1000",
      });

      expect(config.serverUrl).toBe("https://example.com");
      expect(config.botToken).toBe("bot-token");
      expect(config.telegramWhitelist).toEqual([123, 456]);
      expect(config.youtubeDownloadTimeoutMs).toBe(1000);
      expect(config.s3).toBeNull();
    });

    it("should fail before startup when S3 configuration is incomplete", () => {
      expect(() =>
        loadBotAppConfig({
          IS_TEST: "false",
          SERVER_URL: "https://example.com",
          TELEGRAM_BOT_TOKEN: "bot-token",
          TELEGRAM_WHITELIST: "123",
          S3_BUCKET: "audio",
        }),
      ).toThrow("Incomplete S3 configuration. Missing: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY");
    });

    it("should load validated server configuration", () => {
      expect(loadServerAppConfig({ PORT: "8080", LOG_LEVEL: "warn", ADMIN_PASSWORD: "secret" })).toEqual({
        port: 8080,
        logLevel: "warn",
        adminPassword: "secret",
      });
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

    it("should filter out partially numeric values", () => {
      Bun.env.TELEGRAM_WHITELIST = "123456abc,789012";
      expect(getTelegramWhitelist()).toEqual([789012]);
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

    it("should keep duplicate user IDs in their original order", () => {
      Bun.env.TELEGRAM_WHITELIST = "123456,789012,123456";
      expect(getTelegramWhitelist()).toEqual([123456, 789012, 123456]);
    });

    it("should ignore empty comma-separated entries", () => {
      Bun.env.TELEGRAM_WHITELIST = "123456,,789012,";
      expect(getTelegramWhitelist()).toEqual([123456, 789012]);
    });
  });
});
