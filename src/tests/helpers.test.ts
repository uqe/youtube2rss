import { describe, expect, it } from "bun:test";
import { formatSeconds, getFilePath, getYoutubeVideoId, isS3Configured } from "../helpers.ts";

describe("helpers tests", () => {
  describe("getYoutubeVideoId", () => {
    it("getYoutubeVideoId should return null for invalid URLs", () => {
      const invalidUrls = [
        "https://www.google.com",
        "https://www.youtube.com/watch?v=123",
        "https://www.youtube.com/shorts/123",
        "https://www.youtube.com/v/123",
        "https://www.youtube.com/embed/123",
      ];

      invalidUrls.forEach((url) => {
        expect(getYoutubeVideoId(url)).toBeNull();
      });
    });

    it("getYoutubeVideoId should return the video ID for a regular YouTube URL", () => {
      const id = "dQw4w9WgXcQ";

      const validUrls = [
        `https://www.youtube.com/watch?v=${id}`,
        `https://youtu.be/${id}`,
        `https://www.youtube.com/v/${id}`,
        `https://www.youtube.com/shorts/${id}`,
        `https://youtu.be/${id}?t=95`,
      ];

      validUrls.forEach((url) => {
        expect(getYoutubeVideoId(url)).toBe(id);
      });
    });

    it("getYoutubeVideoId should correctly ignore extra query parameters", () => {
      const id = "dQw4w9WgXcQ";
      const url = `https://www.youtube.com/watch?v=${id}&list=PL1234567890`;
      expect(getYoutubeVideoId(url)).toBe(id);
    });

    it("getYoutubeVideoId should handle URLs with mixed case", () => {
      const id = "dQw4w9WgXcQ";
      const url = `https://YOUTU.be/${id}`;
      expect(getYoutubeVideoId(url)).toBe(id);
    });
  });

  describe("isS3Configured", () => {
    it("isS3Configured returns true when all S3 environment variables are set", () => {
      Bun.env.S3_ENDPOINT = "example.com";
      Bun.env.S3_BUCKET = "my-bucket";
      Bun.env.S3_ACCESS_KEY = "my-access-key";
      Bun.env.S3_SECRET_KEY = "my-secret-key";

      const result = isS3Configured();
      expect(result).toBe(true);

      Bun.env.S3_ENDPOINT = "";
      Bun.env.S3_BUCKET = "";
      Bun.env.S3_ACCESS_KEY = "";
      Bun.env.S3_SECRET_KEY = "";
    });

    it("isS3Configured returns false when any S3 environment variable is missing", () => {
      Bun.env.S3_ENDPOINT = "example.com";
      Bun.env.S3_BUCKET = "my-bucket";
      Bun.env.S3_ACCESS_KEY = "my-access-key";
      // S3_SECRET_KEY is missing

      const result = isS3Configured();
      expect(result).toBe(false);

      Bun.env.S3_ENDPOINT = "";
      Bun.env.S3_BUCKET = "";
      Bun.env.S3_ACCESS_KEY = "";
    });
  });

  describe("formatSeconds", () => {
    it("should return 00:00:00 for 0 seconds", () => {
      expect(formatSeconds(0)).toBe("00:00:00");
    });

    it("should format seconds less than 60 correctly", () => {
      expect(formatSeconds(59)).toBe("00:00:59");
    });

    it("should format exactly one minute", () => {
      expect(formatSeconds(60)).toBe("00:01:00");
    });

    it("should format seconds that are a minute and some seconds", () => {
      expect(formatSeconds(61)).toBe("00:01:01");
    });

    it("should format exactly one hour", () => {
      expect(formatSeconds(3600)).toBe("01:00:00");
    });

    it("should format a combination of hours, minutes, and seconds", () => {
      expect(formatSeconds(3661)).toBe("01:01:01");
    });
  });

  describe("formatSeconds", () => {
    it("should return 00:00:00 for 0 seconds", () => {
      expect(formatSeconds(0)).toBe("00:00:00");
    });

    it("should format seconds less than 60 correctly", () => {
      expect(formatSeconds(59)).toBe("00:00:59");
    });

    it("should format exactly one minute", () => {
      expect(formatSeconds(60)).toBe("00:01:00");
    });

    it("should format seconds that are a minute and some seconds", () => {
      expect(formatSeconds(61)).toBe("00:01:01");
    });

    it("should format exactly one hour", () => {
      expect(formatSeconds(3600)).toBe("01:00:00");
    });

    it("should format a combination of hours, minutes, and seconds", () => {
      expect(formatSeconds(3661)).toBe("01:01:01");
    });
  });

  describe("getFilePath", () => {
    const videoId = "testvideo";

    it("should return test path when IS_TEST is true", () => {
      Bun.env.IS_TEST = "true";
      expect(getFilePath(videoId, "mp3")).toBe(`./src/tests/data/${videoId}.mp3`);
      expect(getFilePath(videoId, "mp4")).toBe(`./src/tests/data/${videoId}.mp4`);
    });

    it("should return public path when IS_TEST is false", () => {
      Bun.env.IS_TEST = "";
      expect(getFilePath(videoId, "mp3")).toBe(`./public/files/${videoId}.mp3`);
      expect(getFilePath(videoId, "mp4")).toBe(`./public/files/${videoId}.mp4`);
    });

    it("should handle multiple calls consistently", () => {
      Bun.env.IS_TEST = "true";
      const path1 = getFilePath(videoId, "mp3");
      const path2 = getFilePath(videoId, "mp3");
      expect(path1).toBe(path2);
    });
  });
});
