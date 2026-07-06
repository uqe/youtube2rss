export const isTestEnv = () => Bun.env.IS_TEST === "true";

export const getServerUrl = () => (isTestEnv() ? "https://test.com" : Bun.env.SERVER_URL);

export const getRssFilePath = () => (isTestEnv() ? "./public/rss.test.xml" : "./public/rss.xml");

export const getFilesDir = () => (isTestEnv() ? "./src/tests/data" : "./public/files");

export const getDbFileName = () => (isTestEnv() ? "youtube2rss.test.db" : "youtube2rss.db");

export const defaultYoutubeDownloadTimeoutMs = 30 * 60 * 1000;

export interface YoutubeDlAuthOptions {
  cookies?: string;
  cookiesFromBrowser?: string;
  extractorArgs?: string;
}

const getOptionalEnv = (name: string) => {
  const value = Bun.env[name]?.trim();
  return value ? value : undefined;
};

export const getYoutubeDownloadTimeoutMs = () => {
  const rawTimeout = Bun.env.YOUTUBE_DOWNLOAD_TIMEOUT_MS;

  if (!rawTimeout) {
    return defaultYoutubeDownloadTimeoutMs;
  }

  const timeout = parseInteger(rawTimeout);

  if (Number.isNaN(timeout) || timeout <= 0) {
    throw new Error("YOUTUBE_DOWNLOAD_TIMEOUT_MS must be a positive integer");
  }

  return timeout;
};

export const getYoutubeDlAuthOptions = (): YoutubeDlAuthOptions => {
  const cookiesFromBrowser = getOptionalEnv("YOUTUBE_COOKIES_FROM_BROWSER");
  const extractorArgs = getOptionalEnv("YOUTUBE_EXTRACTOR_ARGS");

  return {
    ...(cookiesFromBrowser
      ? { cookiesFromBrowser }
      : { cookies: getOptionalEnv("YOUTUBE_COOKIES_PATH") ?? "./cookies.txt" }),
    ...(extractorArgs ? { extractorArgs } : {}),
  };
};

export const getS3Config = () => ({
  endpoint: Bun.env.S3_ENDPOINT,
  bucket: Bun.env.S3_BUCKET,
  accessKey: Bun.env.S3_ACCESS_KEY,
  secretKey: Bun.env.S3_SECRET_KEY,
});

export const isS3Configured = () => {
  const config = getS3Config();
  return Boolean(config.endpoint && config.bucket && config.accessKey && config.secretKey);
};

export const getBotToken = () => Bun.env.TELEGRAM_BOT_TOKEN;

export const requireEnv = (name: string): string => {
  const value = Bun.env[name];
  if (!value) {
    throw new Error(`${name} is missing`);
  }
  return value;
};

export const getRequiredServerUrl = () => requireEnv("SERVER_URL");

export const getRequiredBotToken = () => requireEnv("TELEGRAM_BOT_TOKEN");

export const parseInteger = (value: string): number => {
  const normalizedValue = value.trim();
  if (!/^-?\d+$/.test(normalizedValue)) {
    return Number.NaN;
  }

  return Number.parseInt(normalizedValue, 10);
};

export const getPort = () => parseInteger(Bun.env.PORT ?? "3000");

export const getLogLevel = () => Bun.env.LOG_LEVEL ?? "info";

export const parseIntegerList = (value?: string | null): number[] => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => parseInteger(item))
    .filter((item) => !Number.isNaN(item));
};

export const getTelegramWhitelist = () => {
  const envWhitelist = parseIntegerList(Bun.env.TELEGRAM_WHITELIST);
  if (envWhitelist.length === 0) {
    throw new Error("TELEGRAM_WHITELIST environment variable must be set with at least one valid Telegram user ID");
  }
  return envWhitelist;
};
