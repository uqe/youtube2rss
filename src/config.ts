import { config } from "https://deno.land/x/dotenv/mod.ts";

const showError = (msg: string) => {
  throw new Error(msg);
};

const configData = config();

const { TELEGRAM_BOT_TOKEN, SERVER_URL } = configData;

export const serverUrl = SERVER_URL || showError("SERVER_URL is not defined in .env file");
export const telegramBotToken = TELEGRAM_BOT_TOKEN || showError("TELEGRAM_TOKEN is not defined in .env file");
