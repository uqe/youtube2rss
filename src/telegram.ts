import { telegramBotToken } from "./config.ts";
import { createDb } from "./db.ts";
import { Bot } from "./deps.ts";
import { download } from "./download.ts";

const bot = new Bot(telegramBotToken);

const getYoutubeVideoId = (message: string | undefined) => {
  const regex =
    /^https?:\/\/(?:(?:youtu\.be\/)|(?:(?:www\.)?youtube\.com\/(?:(?:watch\?(?:[^&]+&)?vi?=)|(?:vi?\/)|(?:shorts\/))))([a-zA-Z0-9_-]{11,})/gim;

  if (message) {
    const res = regex.exec(message);
    return res && res[1];
  }

  return null;
};

bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

// Whitelist of users allowed to use the bot (Telegram user IDs), add your own here
const whiteList = new Set([169125]);

bot.on("message", async (ctx) => {
  const handler = (text: string) => ctx.reply(text);

  if (!whiteList.has(ctx.message.from.id)) {
    ctx.reply("You are not allowed to use this bot...");
    return;
  }

  const videoId = getYoutubeVideoId(ctx.message.text);

  if (videoId) {
    ctx.reply("Got it! I'll start downloading the video. Please wait...");
    console.log("Start downloading");
    await download(videoId, handler);
    console.log("Downloaded");
  } else {
    ctx.reply("Please send me a valid YouTube video link.");
  }
});

bot.start();
