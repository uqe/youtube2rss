import { Bot } from "./deps.ts";
import { download } from "./download.ts";
import { getYoutubeVideoId } from "./helpers.ts";

if (!Deno.env.get("TELEGRAM_BOT_TOKEN") || !Deno.env.get("SERVER_URL")) {
  if (!Deno.env.get("IS_TEST")) {
    console.error("TELEGRAM_BOT_TOKEN or SERVER_URL variables are missing.");
    Deno.exit(1);
  }
}

const bot = new Bot(Deno.env.get("TELEGRAM_BOT_TOKEN") as string);

bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

// Whitelist of users allowed to use the bot (Telegram user IDs), add your own here
const whiteList = new Set([169125]);

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
