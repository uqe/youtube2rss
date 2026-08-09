import { describe, expect, it } from "bun:test";

import { createLogger, formatLogMessage } from "../logger.ts";

describe("logger", () => {
  it("should render known structured events as readable messages", () => {
    expect(
      formatLogMessage(
        JSON.stringify({
          event: "video_download_started",
          videoId: "2D2jOZy8mSA",
          stage: "download",
        }),
      ),
    ).toBe("Download started  video=2D2jOZy8mSA");
  });

  it("should include stage and reason for structured errors", () => {
    expect(
      formatLogMessage(
        JSON.stringify({
          event: "video_processing_failed",
          videoId: "2D2jOZy8mSA",
          stage: "artwork",
          error: "Error: thumbnail unavailable",
        }),
      ),
    ).toBe("Video processing failed  video=2D2jOZy8mSA  stage=artwork  error=Error: thumbnail unavailable");
  });

  it("should preserve ordinary and malformed messages", () => {
    expect(formatLogMessage("Database is up to date")).toBe("Database is up to date");
    expect(formatLogMessage("{not-json}")).toBe("{not-json}");
  });

  it("should render compact aligned log lines without colors", () => {
    const lines: string[] = [];
    const logger = createLogger({
      now: () => new Date("2026-08-05T07:06:07.000Z"),
      useColors: false,
      write(_level, line) {
        lines.push(line);
      },
    });

    logger.success(
      JSON.stringify({
        event: "video_download_completed",
        videoId: "2D2jOZy8mSA",
        stage: "download",
      }),
    );

    expect(lines).toEqual(["2026-08-05 10:06:07  DONE   Download completed  video=2D2jOZy8mSA"]);
  });
});
