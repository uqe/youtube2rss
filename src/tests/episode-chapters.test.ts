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
    expect(createEpisodeChaptersDocument(null)).toBeNull();
    expect(createEpisodeChaptersDocument("not-an-object")).toBeNull();
    expect(createEpisodeChaptersDocument({ chapters: null })).toBeNull();
    expect(createEpisodeChaptersDocument({})).toBeNull();
  });

  it("should ignore primitive and null chapter entries", () => {
    expect(
      createEpisodeChaptersDocument({
        chapters: [null, false, "chapter", 123, { start_time: 5, title: "Valid" }],
      }),
    ).toEqual({
      version: "1.2.0",
      chapters: [{ startTime: 5, title: "Valid" }],
    });
  });

  it("should reject non-finite and non-numeric start times", () => {
    expect(
      createEpisodeChaptersDocument({
        chapters: [
          { start_time: Number.NaN, title: "NaN" },
          { start_time: Number.POSITIVE_INFINITY, title: "Infinity" },
          { start_time: "10", title: "String" },
        ],
      }),
    ).toBeNull();
  });

  it("should reject missing, non-string, and whitespace-only titles", () => {
    expect(
      createEpisodeChaptersDocument({
        chapters: [{ start_time: 0 }, { start_time: 1, title: 123 }, { start_time: 2, title: "   " }],
      }),
    ).toBeNull();
  });

  it("should omit invalid end times without dropping valid chapters", () => {
    expect(
      createEpisodeChaptersDocument({
        chapters: [
          { start_time: 0, end_time: Number.NaN, title: "NaN end" },
          { start_time: 10, end_time: "20", title: "String end" },
          { start_time: 20, end_time: 20, title: "Equal end" },
          { start_time: 30, end_time: 29, title: "Earlier end" },
        ],
      }),
    ).toEqual({
      version: "1.2.0",
      chapters: [
        { startTime: 0, title: "NaN end" },
        { startTime: 10, title: "String end" },
        { startTime: 20, title: "Equal end" },
        { startTime: 30, title: "Earlier end" },
      ],
    });
  });

  it("should sort chapters by numeric start time", () => {
    expect(
      createEpisodeChaptersDocument({
        chapters: [
          { start_time: 120.5, title: "Third" },
          { start_time: 0, title: "First" },
          { start_time: 60.25, title: "Second" },
        ],
      })?.chapters.map(({ title }) => title),
    ).toEqual(["First", "Second", "Third"]);
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

  it("should tolerate a missing stale chapter file", async () => {
    await expect(writeEpisodeChapters({ chapters: [] }, outputPath)).resolves.toBe(false);
    expect(await Bun.file(outputPath).exists()).toBe(false);
  });

  it("should create nested directories before publishing chapter JSON", async () => {
    const nestedOutputPath = `${import.meta.dir}/data/nested/chapters/episode.json`;

    try {
      await expect(
        writeEpisodeChapters({ chapters: [{ start_time: 0, title: "Intro" }] }, nestedOutputPath),
      ).resolves.toBe(true);
      expect(await Bun.file(nestedOutputPath).json()).toEqual({
        version: "1.2.0",
        chapters: [{ startTime: 0, title: "Intro" }],
      });
    } finally {
      await Bun.file(nestedOutputPath)
        .delete()
        .catch(() => {});
    }
  });
});
