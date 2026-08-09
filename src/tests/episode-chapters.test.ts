import { afterEach, describe, expect, it } from "bun:test";

import { createEpisodeChaptersDocument, writeEpisodeChapters } from "../episode-chapters.ts";

const outputPath = `${import.meta.dir}/data/episode-chapters.json`;

afterEach(async () => {
  await Bun.file(outputPath)
    .delete()
    .catch(() => {});
});

describe("episode chapters", () => {
  it("should normalize valid yt-dlp chapters into Podcasting 2.0 JSON", () => {
    expect(
      createEpisodeChaptersDocument({
        chapters: [
          { start_time: 60, end_time: 120, title: " Main topic " },
          { start_time: 0, end_time: 60, title: "Intro" },
          { start_time: -1, title: "Invalid" },
          { start_time: 120, end_time: 100, title: "Outro" },
          { start_time: 140, title: "" },
        ],
      }),
    ).toEqual({
      version: "1.2.0",
      chapters: [
        { startTime: 0, endTime: 60, title: "Intro" },
        { startTime: 60, endTime: 120, title: "Main topic" },
        { startTime: 120, title: "Outro" },
      ],
    });
  });

  it("should return null when yt-dlp did not provide chapters", () => {
    expect(createEpisodeChaptersDocument({ chapters: null })).toBeNull();
    expect(createEpisodeChaptersDocument({})).toBeNull();
  });

  it("should write a chapter document atomically", async () => {
    await expect(
      writeEpisodeChapters(
        {
          chapters: [{ start_time: 0, end_time: 12.5, title: "Intro" }],
        },
        outputPath,
      ),
    ).resolves.toBe(true);

    expect(await Bun.file(outputPath).json()).toEqual({
      version: "1.2.0",
      chapters: [{ startTime: 0, endTime: 12.5, title: "Intro" }],
    });
  });

  it("should remove a stale file when the video has no chapters", async () => {
    await Bun.write(outputPath, "stale");

    await expect(writeEpisodeChapters({ chapters: null }, outputPath)).resolves.toBe(false);
    expect(await Bun.file(outputPath).exists()).toBe(false);
  });
});
