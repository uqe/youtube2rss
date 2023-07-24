import { assertEquals, describe, it } from "../deps.ts";
import { getYoutubeVideoId } from "../telegram.ts";

describe("telegram tests", () => {
  describe("telegram", () => {
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

  describe("telegram", () => {
    it("getYoutubeVideoId should return the video ID for valid URLs", () => {
      const validUrls = [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ",
        "https://www.youtube.com/v/dQw4w9WgXcQ",
        "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      ];

      validUrls.forEach((url) => {
        assertEquals(getYoutubeVideoId(url), "dQw4w9WgXcQ");
      });
    });
  });
});
