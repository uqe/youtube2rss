import { afterEach, describe, expect, it } from "bun:test";
import { readdir, rm } from "node:fs/promises";

import { downloadEpisodeArtwork } from "../episode-artwork.ts";

const artworkDirectory = `${import.meta.dir}/data/covers`;
const outputPath = `${artworkDirectory}/episode-artwork-test.jpg`;

afterEach(async () => {
  await rm(artworkDirectory, { force: true, recursive: true });
});

describe("episode artwork", () => {
  it("should download, process, and atomically publish artwork", async () => {
    let receivedSource = "";

    await downloadEpisodeArtwork("https://i.ytimg.com/example.jpg", outputPath, {
      async fetchThumbnail() {
        return new Response("thumbnail-data", { status: 200 });
      },
      async processArtwork(sourcePath, preparedPath) {
        receivedSource = await Bun.file(sourcePath).text();
        await Bun.write(preparedPath, "prepared-jpeg");
      },
    });

    expect(receivedSource).toBe("thumbnail-data");
    expect(await Bun.file(outputPath).text()).toBe("prepared-jpeg");
    expect(await readdir(artworkDirectory)).toEqual(["episode-artwork-test.jpg"]);
  });

  it("should reject failed thumbnail responses without publishing a file", async () => {
    await expect(
      downloadEpisodeArtwork("https://i.ytimg.com/missing.jpg", outputPath, {
        async fetchThumbnail() {
          return new Response(null, { status: 404 });
        },
      }),
    ).rejects.toThrow("HTTP 404");

    expect(await Bun.file(outputPath).exists()).toBe(false);
    expect(await readdir(artworkDirectory)).toEqual([]);
  });

  it("should reject non-HTTP thumbnail URLs", async () => {
    await expect(downloadEpisodeArtwork("file:///tmp/thumbnail.jpg", outputPath)).rejects.toThrow(
      "Unsupported thumbnail protocol",
    );
  });

  it("should pass an HTTP URL object to the thumbnail fetcher", async () => {
    let receivedUrl: URL | undefined;

    await downloadEpisodeArtwork("http://images.example.com/thumbnail.jpg", outputPath, {
      async fetchThumbnail(url) {
        receivedUrl = url;
        return new Response("thumbnail-data");
      },
      async processArtwork(_sourcePath, preparedPath) {
        await Bun.write(preparedPath, "prepared-jpeg");
      },
    });

    expect(receivedUrl?.href).toBe("http://images.example.com/thumbnail.jpg");
  });

  it("should clean temporary files when artwork processing fails", async () => {
    await expect(
      downloadEpisodeArtwork("https://i.ytimg.com/example.jpg", outputPath, {
        async fetchThumbnail() {
          return new Response("thumbnail-data");
        },
        async processArtwork() {
          throw new Error("processor failed");
        },
      }),
    ).rejects.toThrow("processor failed");

    expect(await Bun.file(outputPath).exists()).toBe(false);
    expect(await readdir(artworkDirectory)).toEqual([]);
  });

  it("should reject a processor that does not create an output file", async () => {
    await expect(
      downloadEpisodeArtwork("https://i.ytimg.com/example.jpg", outputPath, {
        async fetchThumbnail() {
          return new Response("thumbnail-data");
        },
        async processArtwork() {},
      }),
    ).rejects.toThrow("missing or empty");

    expect(await readdir(artworkDirectory)).toEqual([]);
  });

  it("should reject and remove an empty prepared file", async () => {
    await expect(
      downloadEpisodeArtwork("https://i.ytimg.com/example.jpg", outputPath, {
        async fetchThumbnail() {
          return new Response("thumbnail-data");
        },
        async processArtwork(_sourcePath, preparedPath) {
          await Bun.write(preparedPath, "");
        },
      }),
    ).rejects.toThrow("missing or empty");

    expect(await readdir(artworkDirectory)).toEqual([]);
  });

  it("should preserve an existing published artwork file on failure", async () => {
    await Bun.write(outputPath, "existing-artwork");

    await expect(
      downloadEpisodeArtwork("https://i.ytimg.com/example.jpg", outputPath, {
        async fetchThumbnail() {
          return new Response(null, { status: 503 });
        },
      }),
    ).rejects.toThrow("HTTP 503");

    expect(await Bun.file(outputPath).text()).toBe("existing-artwork");
    expect(await readdir(artworkDirectory)).toEqual(["episode-artwork-test.jpg"]);
  });

  it("should reject malformed thumbnail URLs before creating directories", async () => {
    await expect(downloadEpisodeArtwork("not a URL", outputPath)).rejects.toThrow();
    expect(await Bun.file(artworkDirectory).exists()).toBe(false);
  });
});
