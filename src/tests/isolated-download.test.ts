import { afterEach, beforeEach, expect, it } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { createIsolatedAudioDownloader } from "../download.ts";
import { createTestLibrary } from "./library-fixture.ts";

let library: Awaited<ReturnType<typeof createTestLibrary>>;
beforeEach(async () => {
  library = await createTestLibrary();
});
afterEach(async () => {
  await library.dispose();
});

it("should publish audio only after the download finishes and remove staging files", async () => {
  const output = join(library.directory, "audio.mp3");
  await Bun.write(output, "previous");
  const download = createIsolatedAudioDownloader(async (_id, stagedPath) => {
    expect(stagedPath).not.toBe(output);
    await Bun.write(stagedPath, "new audio");
    expect(await Bun.file(output).text()).toBe("previous");
  });
  await download("video", output);
  expect(await Bun.file(output).text()).toBe("new audio");
  expect((await readdir(library.directory)).filter((name) => name.startsWith(".download-"))).toEqual([]);
});

it("should clean partial downloads and preserve the published file on failure", async () => {
  const output = join(library.directory, "audio.mp3");
  await Bun.write(output, "previous");
  const download = createIsolatedAudioDownloader(async (_id, stagedPath) => {
    await Bun.write(`${stagedPath}.part`, "partial");
    throw new Error("Download interrupted");
  });
  await expect(download("video", output)).rejects.toThrow("Download interrupted");
  expect(await Bun.file(output).text()).toBe("previous");
  expect((await readdir(library.directory)).filter((name) => name.startsWith(".download-"))).toEqual([]);
});
