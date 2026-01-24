import { Bot, GrammyError, HttpError } from "grammy";
import { getRequiredBotToken, getTelegramWhitelist } from "./config.ts";
import { download } from "./download.ts";
import { getYoutubeVideoId } from "./helpers.ts";
import { logger } from "./logger.ts";

const bot = new Bot(getRequiredBotToken());

bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

// Whitelist of users allowed to use the bot (Telegram user IDs), add your own here
const whiteList = new Set(getTelegramWhitelist());

bot.on("message", async (ctx) => {
  const handler = (text: string) => ctx.reply(text);

  if (!whiteList.has(ctx.message.from.id)) {
    ctx.reply("You are not allowed to use this bot...");
    return;
  }

  if (ctx.message.text) {
    const videoId = getYoutubeVideoId(ctx.message.text);

    if (videoId) {
      ctx.reply("Got it! I'll start downloading the video. Please wait...");
      await download(videoId, handler);
    } else {
      ctx.reply("Please send me a valid YouTube video link.");
    }
  }
});

bot.start();
logger.success("Bot is up and running!");

bot.catch((err) => {
  const ctx = err.ctx;
  logger.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});
