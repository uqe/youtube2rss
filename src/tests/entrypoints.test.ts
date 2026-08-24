import { afterEach, describe, expect, it, spyOn } from "bun:test";

import { buildRss } from "../build-rss.ts";
import { createBot, createMessageHandler, startBot } from "../index.ts";
import { prepare } from "../prepare.ts";

const testDatabasePath = "youtube2rss.test.db";
const testRssPath = "./public/rss.test.xml";

afterEach(async () => {
  await Promise.all([
    Bun.file(testDatabasePath)
      .delete()
      .catch(() => {}),
    Bun.file(testRssPath)
      .delete()
      .catch(() => {}),
  ]);
});

describe("entrypoint tests", () => {
  it("should expose script entrypoints without running them on import", () => {
    expect(typeof buildRss).toBe("function");
    expect(typeof prepare).toBe("function");
    expect(typeof createBot).toBe("function");
    expect(typeof createMessageHandler).toBe("function");
    expect(typeof startBot).toBe("function");
  });

  it("should create bot with explicit dependencies", () => {
    const bot = createBot({
      botToken: "123456:test-token",
      telegramWhitelist: [123456],
      async downloadVideo(): Promise<void> {},
    });

    expect(bot).toBeDefined();
  });

  it("should initialize the database through the prepare entrypoint", async () => {
    await Bun.file(testDatabasePath)
      .delete()
      .catch(() => {});

    await prepare();

    expect(await Bun.file(testDatabasePath).exists()).toBe(true);
  });

  it("should build an RSS document and report entrypoint progress", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {});

    try {
      await buildRss();

      expect(await Bun.file(testRssPath).exists()).toBe(true);
      expect(await Bun.file(testRssPath).text()).toContain("<rss");
      expect(log.mock.calls.map(([message]) => message)).toEqual(["Building RSS feed...", "RSS feed built."]);
    } finally {
      log.mockRestore();
    }
  });

  it("message handler should reject users outside whitelist", async () => {
    const replies: string[] = [];
    let downloadCalls = 0;
    const handleMessage = createMessageHandler({
      telegramWhitelist: [123456],
      async downloadVideo(): Promise<void> {
        downloadCalls += 1;
      },
    });

    await handleMessage({
      fromId: 999999,
      text: "https://youtu.be/dQw4w9WgXcQ",
      reply(text): void {
        replies.push(text);
      },
    });

    expect(downloadCalls).toBe(0);
    expect(replies).toEqual(["You are not allowed to use this bot..."]);
  });

  it("message handler should ask for a valid link when text has no video", async () => {
    const replies: string[] = [];
    const handleMessage = createMessageHandler({
      telegramWhitelist: [123456],
      async downloadVideo(): Promise<void> {
        throw new Error("download should not be called");
      },
    });

    await handleMessage({
      fromId: 123456,
      text: "hello",
      reply(text): void {
        replies.push(text);
      },
    });

    expect(replies).toEqual(["Please send me a valid YouTube video link."]);
  });

  it("message handler should silently ignore non-text updates from allowed users", async () => {
    const replies: string[] = [];
    let downloadCalls = 0;
    const handleMessage = createMessageHandler({
      telegramWhitelist: [123456],
      async downloadVideo(): Promise<void> {
        downloadCalls += 1;
      },
    });

    await handleMessage({
      fromId: 123456,
      reply(text): void {
        replies.push(text);
      },
    });

    expect(replies).toEqual([]);
    expect(downloadCalls).toBe(0);
  });

  it("message handler should reject an unlisted user before inspecting message text", async () => {
    let parserCalls = 0;
    const replies: string[] = [];
    const handleMessage = createMessageHandler({
      telegramWhitelist: [],
      async downloadVideo(): Promise<void> {
        throw new Error("download should not be called");
      },
      getVideoId() {
        parserCalls += 1;
        return "dQw4w9WgXcQ";
      },
    });

    await handleMessage({
      fromId: 123456,
      text: "https://youtu.be/dQw4w9WgXcQ",
      reply(text): void {
        replies.push(text);
      },
    });

    expect(parserCalls).toBe(0);
    expect(replies).toEqual(["You are not allowed to use this bot..."]);
  });

  it("message handler should pass the original text to an injected parser", async () => {
    const parsedMessages: string[] = [];
    const downloadedIds: string[] = [];
    const handleMessage = createMessageHandler({
      telegramWhitelist: [123456],
      async downloadVideo(videoId): Promise<void> {
        downloadedIds.push(videoId);
      },
      getVideoId(message) {
        parsedMessages.push(message);
        return "custom-video-id";
      },
    });

    await handleMessage({
      fromId: 123456,
      text: "  exact user text  ",
      reply(): void {},
    });

    expect(parsedMessages).toEqual(["  exact user text  "]);
    expect(downloadedIds).toEqual(["custom-video-id"]);
  });

  it("message handler should not download when the acknowledgement reply fails", async () => {
    let downloadCalls = 0;
    const handleMessage = createMessageHandler({
      telegramWhitelist: [123456],
      async downloadVideo(): Promise<void> {
        downloadCalls += 1;
      },
    });

    await expect(
      handleMessage({
        fromId: 123456,
        text: "https://youtu.be/dQw4w9WgXcQ",
        reply(): never {
          throw new Error("reply failed");
        },
      }),
    ).rejects.toThrow("reply failed");
    expect(downloadCalls).toBe(0);
  });

  it("message handler should propagate download failures after acknowledging the request", async () => {
    const replies: string[] = [];
    const handleMessage = createMessageHandler({
      telegramWhitelist: [123456],
      async downloadVideo(): Promise<void> {
        throw new Error("download failed");
      },
    });

    await expect(
      handleMessage({
        fromId: 123456,
        text: "https://youtu.be/dQw4w9WgXcQ",
        reply(text): void {
          replies.push(text);
        },
      }),
    ).rejects.toThrow("download failed");
    expect(replies).toEqual(["Got it! I'll start downloading the video. Please wait..."]);
  });

  it("message handler should start download for valid YouTube links", async () => {
    const replies: string[] = [];
    const downloadCalls: Array<{ videoId: string }> = [];
    const handleMessage = createMessageHandler({
      telegramWhitelist: [123456],
      async downloadVideo(videoId, handler): Promise<void> {
        downloadCalls.push({ videoId });
        await handler("download finished");
      },
    });

    await handleMessage({
      fromId: 123456,
      text: "watch https://youtu.be/dQw4w9WgXcQ",
      reply(text): void {
        replies.push(text);
      },
    });

    expect(downloadCalls).toEqual([{ videoId: "dQw4w9WgXcQ" }]);
    expect(replies).toEqual(["Got it! I'll start downloading the video. Please wait...", "download finished"]);
  });
});
