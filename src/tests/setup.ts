Bun.env.IS_TEST = "true";

// Bun loads .env before preloads. Keep tests independent of local credentials
// and configuration, including module-level defaults and cached storage.
for (const name of [
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "SERVER_URL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WHITELIST",
  "ADMIN_PASSWORD",
  "PORT",
  "LOG_LEVEL",
  "YOUTUBE_DOWNLOAD_TIMEOUT_MS",
  "YOUTUBE_COOKIES_FROM_BROWSER",
  "YOUTUBE_COOKIES_PATH",
  "YOUTUBE_EXTRACTOR_ARGS",
]) {
  delete Bun.env[name];
}
