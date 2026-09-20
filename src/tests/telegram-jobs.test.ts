import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { Bot } from "grammy";
import type { Api } from "grammy";
import type { Update } from "grammy/types";

import { createJobNotifier, formatJobMessage, installJobBotHandlers, jobKeyboard } from "../telegram-jobs.ts";
import { createTestLibrary, sampleVideo } from "./library-fixture.ts";

let library: Awaited<ReturnType<typeof createTestLibrary>>;
beforeEach(async () => {
  library = await createTestLibrary();
});
afterEach(async () => {
  await library.dispose();
});
const baseUrl = "https://feed.test";
const createBot = () => {
  const bot = new Bot("123456:test", {
    botInfo: {
      id: 123456,
      is_bot: true,
      first_name: "Test",
      username: "test_bot",
      can_join_groups: false,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
      has_topics_enabled: false,
      allows_users_to_create_topics: false,
      can_manage_bots: false,
      supports_join_request_queries: false,
    },
  });
  const calls: Array<{ method: string; payload: Record<string, unknown> }> = [];
  let messageId = 100;
  bot.api.config.use(async (_previous, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    const message = { message_id: messageId++, date: 0, chat: { id: 42, type: "private" }, text: "text" };
    return { ok: true, result: method === "answerCallbackQuery" ? true : message } as never;
  });
  installJobBotHandlers(bot, [42], { ...library, baseUrl });
  return { bot, calls };
};
const messageUpdate = (text: string, user = 42): Update => ({
  update_id: 1,
  message: {
    message_id: 1,
    date: 0,
    chat: { id: user, type: "private", first_name: "User" },
    from: { id: user, is_bot: false, first_name: "User" },
    text,
    ...(text.startsWith("/")
      ? { entities: [{ type: "bot_command" as const, offset: 0, length: text.split(" ")[0].length }] }
      : {}),
  },
});
const callbackUpdate = (data: string, user = 42): Update => ({
  update_id: 2,
  callback_query: {
    id: "callback",
    from: { id: user, is_bot: false, first_name: "User" },
    chat_instance: "instance",
    data,
    message: { message_id: 100, date: 1, chat: { id: user, type: "private", first_name: "User" }, text: "Status" },
  },
});

describe("Telegram job interface", () => {
  it("should enqueue links immediately and persist the status message for restart recovery", async () => {
    const { bot, calls } = createBot();
    await bot.handleUpdate(messageUpdate(sampleVideo.video_url));
    expect(library.jobs.list()).toHaveLength(1);
    expect(library.jobs.messages()[0]).toMatchObject({ chatId: 42, messageId: 100 });
    expect(calls[0].payload.text).toContain("В очереди");
  });
  it("should reject unauthorized commands and callbacks without changing the queue", async () => {
    const { bot, calls } = createBot();
    await bot.handleUpdate(messageUpdate("/collection Private", 99));
    await bot.handleUpdate(callbackUpdate(`retry:${crypto.randomUUID()}`, 99));
    expect(library.collections.list()).toEqual([]);
    expect(library.jobs.list()).toEqual([]);
    expect(calls.map((call) => call.method)).toEqual(["sendMessage", "answerCallbackQuery"]);
  });
  it("should create collections and return queue and RSS information", async () => {
    const { bot, calls } = createBot();
    await bot.handleUpdate(messageUpdate("/collection Интервью"));
    const collection = library.collections.list()[0];
    expect(collection.name).toBe("Интервью");
    await bot.handleUpdate(messageUpdate("/collections"));
    await bot.handleUpdate(messageUpdate("/rss"));
    await bot.handleUpdate(messageUpdate("/queue"));
    expect(calls.some((call) => String(call.payload.text).includes(`/feeds/${collection.id}.xml`))).toBe(true);
    expect(calls.some((call) => call.payload.text === `${baseUrl}/rss.xml`)).toBe(true);
    expect(library.jobs.list()[0].kind).toBe("refresh");
  });
  it("should retry failed jobs through a button and restore message subscriptions", async () => {
    const job = library.jobs.enqueue({ kind: "download", videoId: sampleVideo.video_id });
    library.jobs.claim("owner");
    library.jobs.finish(job.id, "owner", "failed");
    const { bot } = createBot();
    await bot.handleUpdate(callbackUpdate(`retry:${job.id}`));
    expect(library.jobs.get(job.id)?.status).toBe("queued");
    expect(library.jobs.messages()).toHaveLength(1);
  });
  it("should offer collections and enqueue membership from the selected button", async () => {
    library.videos.create(sampleVideo);
    const collection = library.collections.create("Listen later");
    const { bot, calls } = createBot();
    await bot.handleUpdate(callbackUpdate(`choose:${sampleVideo.video_id}`));
    expect(JSON.stringify(calls)).toContain(`collect:${sampleVideo.video_id}:${collection.id}`);
    await bot.handleUpdate(callbackUpdate(`collect:${sampleVideo.video_id}:${collection.id}`));
    expect(library.jobs.list()[0]).toMatchObject({ kind: "collection-add", collectionId: collection.id });
  });
  it("should edit one message only when progress changes and deliver terminal state once", async () => {
    const job = library.jobs.enqueue({ kind: "download", videoId: sampleVideo.video_id });
    library.jobs.subscribe(job.id, 42, 100);
    const edit = mock(async () => true);
    const api = { editMessageText: edit } as unknown as Pick<Api, "editMessageText">;
    const notify = createJobNotifier(api, library.jobs, baseUrl);
    await notify();
    await notify();
    expect(edit).toHaveBeenCalledTimes(1);
    library.jobs.claim("owner");
    library.jobs.progress(job.id, "owner", { stage: "download", percent: 12, message: "Downloading" });
    await createJobNotifier(api, library.jobs, baseUrl)();
    expect(edit).toHaveBeenCalledTimes(2);
    library.jobs.finish(job.id, "owner", "published");
    await notify();
    await notify();
    expect(edit).toHaveBeenCalledTimes(3);
    expect(library.jobs.messages()).toEqual([]);
  });
  it("should preserve retry notifications and stop delivering to a blocked chat", async () => {
    const job = library.jobs.enqueue({ kind: "refresh" });
    library.jobs.subscribe(job.id, 42, 100);
    const edit = mock(async () => {
      throw Object.assign(new Error("blocked"), { error_code: 403, description: "blocked" });
    });
    await createJobNotifier(
      { editMessageText: edit } as unknown as Pick<Api, "editMessageText">,
      library.jobs,
      baseUrl,
    )();
    expect(library.jobs.messages()).toEqual([]);
  });
  it("should show a retry button on terminal failure and a collection-specific RSS link", () => {
    const collection = library.collections.create("Interviews");
    const job = library.jobs.enqueue({ kind: "download", videoId: sampleVideo.video_id, collectionId: collection.id });
    const failed = { ...job, status: "completed" as const, result: "failed" };
    expect(formatJobMessage(failed)).toContain("Повторить");
    expect(JSON.stringify(jobKeyboard(failed, baseUrl))).toContain(`retry:${job.id}`);
    expect(JSON.stringify(jobKeyboard(failed, baseUrl))).toContain(`/feeds/${collection.id}.xml`);
  });
});
