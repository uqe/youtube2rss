import { getRequiredBotToken, getTelegramWhitelist } from "./config.ts";
import { download } from "./download.ts";
import { getYoutubeVideoId } from "./helpers.ts";
import { logger } from "./logger.ts";
import { Bot, GrammyError, HttpError } from "grammy";
import type { Message } from "grammy/types";

interface BotLogger {
  success(message: string): void;
  error(message: string): void;
}

type ReplyHandler = (text: string) => Promise<Message.TextMessage> | void;
type DownloadVideo = (videoId: string, handler: ReplyHandler) => Promise<void>;
type GetVideoId = (text: string) => string | null;

interface BotDependencies {
  botToken?: string;
  telegramWhitelist?: number[];
  downloadVideo?: DownloadVideo;
  logger?: BotLogger;
}

export interface IncomingBotMessage {
  fromId: number;
  text?: string;
  reply(text: string): Promise<Message.TextMessage> | void;
}

interface MessageHandlerOptions {
  telegramWhitelist: number[];
  downloadVideo: DownloadVideo;
  getVideoId?: GetVideoId;
}

export const createMessageHandler = ({
  telegramWhitelist,
  downloadVideo,
  getVideoId = getYoutubeVideoId,
}: MessageHandlerOptions) => {
  const whiteList = new Set(telegramWhitelist);

  return async ({ fromId, text, reply }: IncomingBotMessage) => {
    const handler = (message: string) => reply(message);

    if (!whiteList.has(fromId)) {
      await reply("You are not allowed to use this bot...");
      return;
    }

    if (!text) {
      return;
    }

    const videoId = getVideoId(text);

    if (!videoId) {
      await reply("Please send me a valid YouTube video link.");
      return;
    }

    await reply("Got it! I'll start downloading the video. Please wait...");
    await downloadVideo(videoId, handler);
  };
};

export const createBot = ({
  botToken = getRequiredBotToken(),
  telegramWhitelist = getTelegramWhitelist(),
  downloadVideo = download,
}: BotDependencies = {}) => {
  const bot = new Bot(botToken);
  const handleMessage = createMessageHandler({
    telegramWhitelist,
    downloadVideo,
  });

  bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

  bot.on("message", async (ctx) => {
    await handleMessage({
      fromId: ctx.message.from.id,
      text: ctx.message.text,
      reply: (text) => ctx.reply(text),
    });
  });

  return bot;
};

export const startBot = ({ logger: botLogger = logger, ...dependencies }: BotDependencies = {}) => {
  const bot = createBot(dependencies);

  bot.catch((err) => {
    const ctx = err.ctx;
    botLogger.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
      console.error("Error in request:", e.description);
    } else if (e instanceof HttpError) {
      console.error("Could not contact Telegram:", e);
    } else {
      console.error("Unknown error:", e);
    }
  });

  bot.start();
  botLogger.success("Bot is up and running!");

  return bot;
};

if (import.meta.main) {
  startBot();
}
