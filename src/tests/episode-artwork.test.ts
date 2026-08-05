import { downloadEpisodeArtwork } from "../episode-artwork.ts";
import { afterEach, describe, expect, it } from "bun:test";
import { readdir, rm } from "node:fs/promises";

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
      })
    ).rejects.toThrow("HTTP 404");

    expect(await Bun.file(outputPath).exists()).toBe(false);
    expect(await readdir(artworkDirectory)).toEqual([]);
  });

  it("should reject non-HTTP thumbnail URLs", async () => {
    await expect(downloadEpisodeArtwork("file:///tmp/thumbnail.jpg", outputPath)).rejects.toThrow(
      "Unsupported thumbnail protocol"
    );
  });
});
