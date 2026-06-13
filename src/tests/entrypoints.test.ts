import { buildRss } from "../build-rss.ts";
import { createBot, createMessageHandler, startBot } from "../index.ts";
import { prepare } from "../prepare.ts";
import { describe, expect, it } from "bun:test";

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
