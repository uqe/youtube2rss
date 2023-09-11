import { assertEquals, describe, it } from "../deps.ts";
import { getYoutubeVideoId, isS3Configured } from "../helpers.ts";

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
        assertEquals(getYoutubeVideoId(url), null);
      });
    });
  });

  describe("getYoutubeVideoId", () => {
    it("getYoutubeVideoId should return the video ID for a regular YouTube URL", () => {
      const validUrls = [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ",
        "https://www.youtube.com/v/dQw4w9WgXcQ",
        "https://www.youtube.com/shorts/dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ?t=95",
      ];

      validUrls.forEach((url) => {
        assertEquals(getYoutubeVideoId(url), "dQw4w9WgXcQ");
      });
    });
  });

  describe("isS3Configured", () => {
    it("isS3Configured returns true when all S3 environment variables are set", () => {
      Deno.env.set("S3_ENDPOINT", "example.com");
      Deno.env.set("S3_BUCKET", "my-bucket");
      Deno.env.set("S3_ACCESS_KEY", "my-access-key");
      Deno.env.set("S3_SECRET_KEY", "my-secret-key");

      const result = isS3Configured();
      assertEquals(result, true);

      Deno.env.delete("S3_ENDPOINT");
      Deno.env.delete("S3_BUCKET");
      Deno.env.delete("S3_ACCESS_KEY");
      Deno.env.delete("S3_SECRET_KEY");
    });
  });

  describe("isS3Configured", () => {
    it("isS3Configured returns false when any S3 environment variable is missing", () => {
      Deno.env.set("S3_ENDPOINT", "example.com");
      Deno.env.set("S3_BUCKET", "my-bucket");
      Deno.env.set("S3_ACCESS_KEY", "my-access-key");

      const result = isS3Configured();
      assertEquals(result, false);

      Deno.env.delete("S3_ENDPOINT");
      Deno.env.delete("S3_BUCKET");
      Deno.env.delete("S3_ACCESS_KEY");
    });
  });
});
