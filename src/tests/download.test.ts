import { createAudioDownloader, createDownloader, createVideoFromInfo } from "../download.ts";
import type { DownloadDependencies } from "../download.ts";
import type { Storage } from "../storage.ts";
import type { Video } from "../types.ts";
import { afterEach, describe, expect, it, spyOn } from "bun:test";
import type { Payload } from "youtube-dl-exec";

const testFiles = new Set<string>();

const createPayload = (overrides: Partial<Payload> = {}): Payload =>
  ({
    id: "downloadTestId",
    title: "Download Test",
    description: "Download test description",
    webpage_url: "https://www.youtube.com/watch?v=downloadTest",
    duration: 123,
    ...overrides,
  }) as Payload;

const createRepository = (initialVideos: Video[] = []) => {
  const videos = [...initialVideos];

  return {
    videos,
    repository: {
      create(video: Video): void {
        videos.push(video);
      },
      list(): Video[] {
        return videos;
      },
      exists(videoId: string): boolean {
        return videos.some((video) => video.video_id === videoId);
      },
    },
  };
};

const createStorage = () => {
  let uploadAudioCalls = 0;
  const storage: Storage = {
    async uploadAudio(): Promise<void> {
      uploadAudioCalls += 1;
    },
    async uploadRss(): Promise<void> {},
    async ensureCoverImage(): Promise<void> {},
  };

  return {
    storage,
    get uploadAudioCalls() {
      return uploadAudioCalls;
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

  return {
    repository,
    async downloadAudio(): Promise<void> {},
    async getVideoInfo(): Promise<Payload> {
      return createPayload();
    },
    async generateFeed(): Promise<void> {},
    getFilePath(videoId: string): string {
      const filePath = `./src/tests/data/${videoId}.download-test.mp3`;
      testFiles.add(filePath);
      return filePath;
    },
    getStorage(): Storage {
      return storage;
    },
    isTestEnv: () => true,
    now: () => new Date("2026-01-02T03:04:05.000Z"),
    logger: createLogger(),
    ...overrides,
  };
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
      250000
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
      })
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

    const download = createDownloader(
      createDependencies({
        repository,
        async downloadAudio(_videoId, outputFilePath): Promise<void> {
          await Bun.write(outputFilePath, "audio");
        },
        getStorage: () => storageState.storage,
        isTestEnv: () => false,
        async generateFeed(videosToGenerate): Promise<void> {
          feedVideos = [...videosToGenerate];
        },
      })
    );

    await download("downloadTestId", (text) => {
      replies.push(text);
    });

    expect(videos).toHaveLength(1);
    expect(videos[0]).toMatchObject({
      video_id: "downloadTestId",
      video_name: "Download Test",
      video_path: "./src/tests/data/downloadTestId.download-test.mp3",
      video_added_date: "2026-01-02T03:04:05.000Z",
    });
    expect(feedVideos).toEqual(videos);
    expect(storageState.uploadAudioCalls).toBe(1);
    expect(replies).toEqual(["RSS feed was successfully updated."]);
  });

  it("should not save video info when downloaded file is missing", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    const { repository, videos } = createRepository();
    let feedCalls = 0;
    const replies: string[] = [];

    const download = createDownloader(
      createDependencies({
        repository,
        async downloadAudio(): Promise<void> {},
        async generateFeed(): Promise<void> {
          feedCalls += 1;
        },
      })
    );

    await download("missingFile", (text) => {
      replies.push(text);
    });

    expect(videos).toEqual([]);
    expect(feedCalls).toBe(0);
    expect(replies).toEqual(["Something went wrong. Please try again later..."]);

    consoleError.mockRestore();
  });
});
