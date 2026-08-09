import { afterEach, describe, expect, it } from "bun:test";

import type { Payload } from "youtube-dl-exec";

import type { PublicationStatus } from "../db.ts";
import { createAudioDownloader, createDownloader, createVideoFromInfo } from "../download.ts";
import type { DownloadDependencies, DownloadProgress } from "../download.ts";
import { writeEpisodeChapters } from "../episode-chapters.ts";
import type { Storage } from "../storage.ts";
import type { Video } from "../types.ts";

const testFiles = new Set<string>();

const createPayload = (overrides: Record<string, unknown> = {}): Payload =>
  ({
    id: "downloadTestId",
    title: "Download Test",
    description: "Download test description",
    webpage_url: "https://www.youtube.com/watch?v=downloadTest",
    thumbnail: "https://i.ytimg.com/vi/downloadTest/maxresdefault.jpg",
    duration: 123,
    ...overrides,
  }) as Payload;

const createRepository = (initialVideos: Video[] = []) => {
  const videos = [...initialVideos];
  const publicationStatuses = new Map<string, PublicationStatus>(
    initialVideos.map((video) => [video.video_id, "published"]),
  );

  return {
    videos,
    publicationStatuses,
    repository: {
      create(video: Video, publicationStatus: PublicationStatus = "published"): void {
        videos.push(video);
        publicationStatuses.set(video.video_id, publicationStatus);
      },
      list(): Video[] {
        return videos;
      },
      getPublicationStatus(videoId: string): PublicationStatus | null {
        return publicationStatuses.get(videoId) ?? null;
      },
      markPublished(videoId: string): void {
        publicationStatuses.set(videoId, "published");
      },
    },
  };
};

const createStorage = () => {
  let uploadAudioCalls = 0;
  let uploadArtworkCalls = 0;
  let uploadChaptersCalls = 0;
  const storage: Storage = {
    kind: "local",
    async uploadAudio(): Promise<void> {
      uploadAudioCalls += 1;
    },
    async uploadArtwork(): Promise<void> {
      uploadArtworkCalls += 1;
    },
    async uploadChapters(): Promise<void> {
      uploadChaptersCalls += 1;
    },
    async uploadRss(): Promise<void> {},
    async ensureCoverImage(): Promise<void> {},
    async getAudioMetadata(): Promise<{ exists: boolean }> {
      return { exists: true };
    },
    async getArtworkMetadata(): Promise<{ exists: boolean }> {
      return { exists: true };
    },
    async getChaptersMetadata(): Promise<{ exists: boolean }> {
      return { exists: true };
    },
    async deleteEpisodeAssets(): Promise<void> {},
  };

  return {
    storage,
    get uploadAudioCalls() {
      return uploadAudioCalls;
    },
    get uploadArtworkCalls() {
      return uploadArtworkCalls;
    },
    get uploadChaptersCalls() {
      return uploadChaptersCalls;
    },
  };
};

const createLogger = () => ({
  info(): void {},
  success(): void {},
  error(): void {},
});

const createDependencies = (overrides: Partial<DownloadDependencies> = {}): DownloadDependencies => {
  const { repository } = createRepository();
  const { storage } = createStorage();

  const dependencies: DownloadDependencies = {
    repository,
    async downloadAudio(): Promise<void> {},
    async downloadArtwork(_thumbnailUrl, outputFilePath): Promise<void> {
      await Bun.write(outputFilePath, "artwork");
    },
    writeChapters: writeEpisodeChapters,
    async getVideoInfo(): Promise<Payload> {
      return createPayload();
    },
    async generateFeed(): Promise<void> {},
    getFilePath(videoId: string): string {
      const filePath = `./src/tests/data/${videoId}.download-test.mp3`;
      testFiles.add(filePath);
      return filePath;
    },
    getArtworkPath(videoId: string): string {
      const filePath = `./src/tests/data/${videoId}.download-test.jpg`;
      testFiles.add(filePath);
      return filePath;
    },
    getChaptersPath(videoId: string): string {
      const filePath = `./src/tests/data/${videoId}.download-test.json`;
      testFiles.add(filePath);
      return filePath;
    },
    getStorage(): Storage {
      return storage;
    },
    async deleteFile(filePath: string): Promise<void> {
      await Bun.file(filePath)
        .delete()
        .catch(() => {});
    },
    now: () => new Date("2026-01-02T03:04:05.000Z"),
    logger: createLogger(),
  };

  return { ...dependencies, ...overrides };
};

afterEach(async () => {
  for (const filePath of testFiles) {
    await Bun.file(filePath)
      .delete()
      .catch(() => {});
  }
  testFiles.clear();
});

describe("download tests", () => {
  const originalYoutubeCookiesFromBrowser = Bun.env.YOUTUBE_COOKIES_FROM_BROWSER;
  const originalYoutubeCookiesPath = Bun.env.YOUTUBE_COOKIES_PATH;
  const originalYoutubeExtractorArgs = Bun.env.YOUTUBE_EXTRACTOR_ARGS;

  afterEach(() => {
    Bun.env.YOUTUBE_COOKIES_FROM_BROWSER = originalYoutubeCookiesFromBrowser;
    Bun.env.YOUTUBE_COOKIES_PATH = originalYoutubeCookiesPath;
    Bun.env.YOUTUBE_EXTRACTOR_ARGS = originalYoutubeExtractorArgs;
  });

  it("createAudioDownloader should call youtube-dl with canonical URL and output path", async () => {
    Bun.env.YOUTUBE_COOKIES_FROM_BROWSER = undefined;
    Bun.env.YOUTUBE_COOKIES_PATH = undefined;
    Bun.env.YOUTUBE_EXTRACTOR_ARGS = undefined;

    const calls: Array<{
      url: string;
      options: Record<string, unknown>;
      executionOptions: Record<string, unknown>;
    }> = [];
    const downloadAudio = createAudioDownloader({
      async exec(url, options, executionOptions): Promise<void> {
        calls.push({ url, options, executionOptions });
      },
    });

    await downloadAudio("dQw4w9WgXcQ", "/tmp/audio.mp3");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(calls[0].options).toMatchObject({
      format: "bestaudio[ext=m4a]/bestaudio/best",
      extractAudio: true,
      audioFormat: "mp3",
      output: "/tmp/audio.mp3",
      cookies: "./cookies.txt",
      embedThumbnail: true,
      embedChapters: true,
    });
    expect(calls[0].executionOptions).toEqual({ timeout: 1800000, killSignal: "SIGKILL" });
  });

  it("createAudioDownloader should pass browser cookies and extractor args", async () => {
    Bun.env.YOUTUBE_COOKIES_FROM_BROWSER = "chrome";
    Bun.env.YOUTUBE_EXTRACTOR_ARGS = "youtube:formats=missing_pot";

    const calls: Array<{
      options: Record<string, unknown>;
    }> = [];
    const downloadAudio = createAudioDownloader({
      async exec(_url, options): Promise<void> {
        calls.push({ options });
      },
    });

    await downloadAudio("dQw4w9WgXcQ", "/tmp/audio.mp3");

    expect(calls[0].options).toMatchObject({
      cookiesFromBrowser: "chrome",
      extractorArgs: "youtube:formats=missing_pot",
    });
    expect(calls[0].options).not.toHaveProperty("cookies");
  });

  it("createAudioDownloader should accept a custom timeout", async () => {
    const calls: Array<{
      executionOptions: Record<string, unknown>;
    }> = [];
    const downloadAudio = createAudioDownloader(
      {
        async exec(_url, _options, executionOptions): Promise<void> {
          calls.push({ executionOptions });
        },
      },
      250000,
    );

    await downloadAudio("dQw4w9WgXcQ", "/tmp/audio.mp3");

    expect(calls[0].executionOptions).toEqual({ timeout: 250000, killSignal: "SIGKILL" });
  });

  it("createVideoFromInfo should map video info to database record", () => {
    const addedAt = new Date("2026-01-02T03:04:05.000Z");
    const video = createVideoFromInfo(createPayload(), "/tmp/audio.mp3", addedAt);

    expect(video).toEqual({
      video_id: "downloadTestId",
      video_name: "Download Test",
      video_description: "Download test description",
      video_url: "https://www.youtube.com/watch?v=downloadTest",
      video_added_date: "2026-01-02T03:04:05.000Z",
      video_path: "/tmp/audio.mp3",
      video_artwork_path: null,
      video_chapters_path: null,
      video_length: 123,
    });
  });

  it("should stop early when video already exists", async () => {
    const existingVideo = createVideoFromInfo(createPayload({ id: "alreadyExists" }), "/tmp/audio.mp3", new Date());
    const { repository } = createRepository([existingVideo]);
    let downloadAudioCalls = 0;
    let getStorageCalls = 0;
    const replies: string[] = [];

    const download = createDownloader(
      createDependencies({
        repository,
        async downloadAudio(): Promise<void> {
          downloadAudioCalls += 1;
        },
        getStorage(): Storage {
          getStorageCalls += 1;
          return createStorage().storage;
        },
      }),
    );

    await download("alreadyExists", (text) => {
      replies.push(text);
    });

    expect(downloadAudioCalls).toBe(0);
    expect(getStorageCalls).toBe(0);
    expect(replies).toEqual(["Video already exists. Find it in the RSS feed."]);
  });

  it("should save video info and regenerate feed after successful download", async () => {
    const { repository, videos } = createRepository();
    const storageState = createStorage();
    let feedVideos: Video[] = [];
    const replies: string[] = [];
    const progress: DownloadProgress[] = [];

    const download = createDownloader(
      createDependencies({
        repository,
        async downloadAudio(_videoId, outputFilePath): Promise<void> {
          await Bun.write(outputFilePath, "audio");
        },
        async getVideoInfo(): Promise<Payload> {
          return createPayload({
            chapters: [
              { start_time: 0, end_time: 60, title: "Intro" },
              { start_time: 60, end_time: 123, title: "Main topic" },
            ],
          });
        },
        getStorage: () => storageState.storage,
        async generateFeed(videosToGenerate): Promise<void> {
          feedVideos = [...videosToGenerate];
        },
      }),
    );

    await download(
      "downloadTestId",
      (text) => {
        replies.push(text);
      },
      (update) => progress.push(update),
    );

    expect(videos).toHaveLength(1);
    expect(videos[0]).toMatchObject({
      video_id: "downloadTestId",
      video_name: "Download Test",
      video_path: "./src/tests/data/downloadTestId.download-test.mp3",
      video_artwork_path: "./src/tests/data/downloadTestId.download-test.jpg",
      video_chapters_path: "./src/tests/data/downloadTestId.download-test.json",
      video_added_date: "2026-01-02T03:04:05.000Z",
    });
    expect(feedVideos).toEqual(videos);
    expect(storageState.uploadAudioCalls).toBe(1);
    expect(storageState.uploadArtworkCalls).toBe(1);
    expect(storageState.uploadChaptersCalls).toBe(1);
    expect(replies).toEqual(["RSS feed was successfully updated."]);
    expect(progress.map(({ stage, percent }) => [stage, percent])).toEqual([
      ["lookup", 5],
      ["download", 12],
      ["validate", 48],
      ["metadata", 54],
      ["chapters", 58],
      ["artwork", 64],
      ["upload-audio", 72],
      ["upload-artwork", 80],
      ["upload-chapters", 86],
      ["persist", 92],
      ["publish-feed", 97],
      ["completed", 100],
    ]);
  });

  it("should not save video info when downloaded file is missing", async () => {
    const { repository, videos } = createRepository();
    let feedCalls = 0;
    const replies: string[] = [];
    const errors: string[] = [];

    const download = createDownloader(
      createDependencies({
        repository,
        async downloadAudio(): Promise<void> {},
        async generateFeed(): Promise<void> {
          feedCalls += 1;
        },
        logger: {
          info(): void {},
          success(): void {},
          error(message): void {
            errors.push(message);
          },
        },
      }),
    );

    await download("missingFile", (text) => {
      replies.push(text);
    });

    expect(videos).toEqual([]);
    expect(feedCalls).toBe(0);
    expect(replies).toEqual(["Something went wrong. Please try again later..."]);
    expect(errors.some((message) => JSON.parse(message).stage === "validate")).toBe(true);
  });

  it("should publish normally when yt-dlp did not provide chapters", async () => {
    const { repository, videos } = createRepository();
    const storageState = createStorage();
    const result = await createDownloader(
      createDependencies({
        repository,
        async downloadAudio(_videoId, outputFilePath): Promise<void> {
          await Bun.write(outputFilePath, "audio");
        },
        getStorage: () => storageState.storage,
      }),
    )("noChaptersVideo");

    expect(result).toEqual({ status: "published" });
    expect(videos[0].video_chapters_path).toBeNull();
    expect(storageState.uploadChaptersCalls).toBe(0);
  });

  it("should roll back uploaded audio and artwork when artwork upload fails", async () => {
    const { repository, videos } = createRepository();
    const deletedAssets: Array<[string, string, string | null | undefined]> = [];
    const storage: Storage = {
      ...createStorage().storage,
      async uploadArtwork(): Promise<void> {
        throw new Error("Artwork upload failed");
      },
      async deleteEpisodeAssets(videoId, audioPath, artworkPath): Promise<void> {
        deletedAssets.push([videoId, audioPath, artworkPath]);
      },
    };
    const result = await createDownloader(
      createDependencies({
        repository,
        async downloadAudio(_videoId, outputFilePath): Promise<void> {
          await Bun.write(outputFilePath, "audio");
        },
        getStorage: () => storage,
      }),
    )("rollbackAssets");

    expect(result).toEqual({ status: "failed" });
    expect(videos).toEqual([]);
    expect(deletedAssets).toEqual([
      [
        "rollbackAssets",
        "./src/tests/data/rollbackAssets.download-test.mp3",
        "./src/tests/data/rollbackAssets.download-test.jpg",
      ],
    ]);
  });

  it("should roll back chapter assets when chapter upload fails", async () => {
    const { repository, videos } = createRepository();
    const deletedAssets: Array<[string, string, string | null | undefined, string | null | undefined]> = [];
    const storage: Storage = {
      ...createStorage().storage,
      async uploadChapters(): Promise<void> {
        throw new Error("Chapter upload failed");
      },
      async deleteEpisodeAssets(videoId, audioPath, artworkPath, chaptersPath): Promise<void> {
        deletedAssets.push([videoId, audioPath, artworkPath, chaptersPath]);
      },
    };
    const result = await createDownloader(
      createDependencies({
        repository,
        async downloadAudio(_videoId, outputFilePath): Promise<void> {
          await Bun.write(outputFilePath, "audio");
        },
        async getVideoInfo(): Promise<Payload> {
          return createPayload({ chapters: [{ start_time: 0, title: "Intro" }] });
        },
        getStorage: () => storage,
      }),
    )("rollbackChapters");

    expect(result).toEqual({ status: "failed" });
    expect(videos).toEqual([]);
    expect(deletedAssets).toEqual([
      [
        "rollbackChapters",
        "./src/tests/data/rollbackChapters.download-test.mp3",
        "./src/tests/data/rollbackChapters.download-test.jpg",
        "./src/tests/data/rollbackChapters.download-test.json",
      ],
    ]);
  });

  it("should recover a pending publication without downloading again", async () => {
    const { repository, publicationStatuses } = createRepository();
    let downloadAudioCalls = 0;
    let generateFeedCalls = 0;
    const replies: string[] = [];
    const download = createDownloader(
      createDependencies({
        repository,
        async downloadAudio(_videoId, outputFilePath): Promise<void> {
          downloadAudioCalls += 1;
          await Bun.write(outputFilePath, "audio");
        },
        async getVideoInfo(videoId): Promise<Payload> {
          return createPayload({ id: videoId });
        },
        async generateFeed(): Promise<void> {
          generateFeedCalls += 1;
          if (generateFeedCalls === 1) {
            throw new Error("RSS upload failed");
          }
        },
      }),
    );

    const firstResult = await download("recoverVideo", (text) => {
      replies.push(text);
    });
    const secondResult = await download("recoverVideo", (text) => {
      replies.push(text);
    });

    expect(firstResult).toEqual({ status: "failed" });
    expect(secondResult).toEqual({ status: "recovered" });
    expect(downloadAudioCalls).toBe(1);
    expect(generateFeedCalls).toBe(2);
    expect(publicationStatuses.get("recoverVideo")).toBe("published");
    expect(replies).toEqual([
      "Something went wrong. Please try again later...",
      "RSS feed publication was successfully recovered.",
    ]);
  });

  it("should keep a publication pending when its audio is unavailable", async () => {
    const pendingVideo = createVideoFromInfo(
      createPayload({ id: "missingPendingAudio" }),
      "/missing/audio.mp3",
      new Date(),
    );
    const { repository, publicationStatuses } = createRepository([pendingVideo]);
    publicationStatuses.set("missingPendingAudio", "pending");
    let generateFeedCalls = 0;

    const result = await createDownloader(
      createDependencies({
        repository,
        getStorage: () => ({
          ...createStorage().storage,
          async getAudioMetadata(): Promise<{ exists: boolean }> {
            return { exists: false };
          },
        }),
        async generateFeed(): Promise<void> {
          generateFeedCalls += 1;
        },
      }),
    )("missingPendingAudio");

    expect(result).toEqual({ status: "failed" });
    expect(generateFeedCalls).toBe(0);
    expect(publicationStatuses.get("missingPendingAudio")).toBe("pending");
  });

  it("should serialize video processing to protect RSS publication", async () => {
    const { repository } = createRepository();
    const events: string[] = [];
    let releaseFirstDownload: (() => void) | undefined;
    let signalFirstStarted: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
      signalFirstStarted = resolve;
    });
    const firstDownloadGate = new Promise<void>((resolve) => {
      releaseFirstDownload = resolve;
    });
    const download = createDownloader(
      createDependencies({
        repository,
        async downloadAudio(videoId, outputFilePath): Promise<void> {
          events.push(`download:${videoId}`);
          if (videoId === "firstVideo") {
            signalFirstStarted?.();
            await firstDownloadGate;
          }
          await Bun.write(outputFilePath, "audio");
        },
        async getVideoInfo(videoId): Promise<Payload> {
          return createPayload({ id: videoId });
        },
        async generateFeed(videos): Promise<void> {
          events.push(`feed:${videos.map((video) => video.video_id).join(",")}`);
        },
      }),
    );

    const first = download("firstVideo");
    await firstStarted;
    const second = download("secondVideo");
    await Promise.resolve();

    expect(events).toEqual(["download:firstVideo"]);

    releaseFirstDownload?.();
    await Promise.all([first, second]);

    expect(events).toEqual([
      "download:firstVideo",
      "feed:firstVideo",
      "download:secondVideo",
      "feed:firstVideo,secondVideo",
    ]);
  });
});
