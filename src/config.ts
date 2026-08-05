export type Environment = Record<string, string | undefined>;

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface S3Config {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

export interface AppConfig {
  serverUrl: string;
  rssFilePath: string;
  filesDir: string;
  dbFileName: string;
  youtubeDownloadTimeoutMs: number;
  youtubeDlAuthOptions: YoutubeDlAuthOptions;
  s3: S3Config | null;
}

export interface BotAppConfig extends AppConfig {
  botToken: string;
  telegramWhitelist: number[];
}

export interface ServerAppConfig {
  port: number;
  logLevel: LogLevel;
}

export const isTestEnv = (environment: Environment = Bun.env) => environment.IS_TEST === "true";

const getOptionalEnv = (name: string, environment: Environment = Bun.env) => {
  const value = environment[name]?.trim();
  return value ? value : undefined;
};

export const getServerUrl = (environment: Environment = Bun.env) =>
  isTestEnv(environment) ? "https://test.com" : getOptionalEnv("SERVER_URL", environment);

export const getRssFilePath = (environment: Environment = Bun.env) =>
  isTestEnv(environment) ? "./public/rss.test.xml" : "./public/rss.xml";

export const getFilesDir = (environment: Environment = Bun.env) =>
  isTestEnv(environment) ? "./src/tests/data" : "./public/files";

export const getDbFileName = (environment: Environment = Bun.env) =>
  isTestEnv(environment) ? "youtube2rss.test.db" : "youtube2rss.db";

export const defaultYoutubeDownloadTimeoutMs = 30 * 60 * 1000;

export interface YoutubeDlAuthOptions {
  cookies?: string;
  cookiesFromBrowser?: string;
  extractorArgs?: string;
}

export const getYoutubeDownloadTimeoutMs = (environment: Environment = Bun.env) => {
  const rawTimeout = environment.YOUTUBE_DOWNLOAD_TIMEOUT_MS;

  if (!rawTimeout) {
    return defaultYoutubeDownloadTimeoutMs;
  }

  const timeout = parseInteger(rawTimeout);

  if (Number.isNaN(timeout) || timeout <= 0) {
    throw new Error("YOUTUBE_DOWNLOAD_TIMEOUT_MS must be a positive integer");
  }

  return timeout;
};

export const getYoutubeDlAuthOptions = (environment: Environment = Bun.env): YoutubeDlAuthOptions => {
  const cookiesFromBrowser = getOptionalEnv("YOUTUBE_COOKIES_FROM_BROWSER", environment);
  const extractorArgs = getOptionalEnv("YOUTUBE_EXTRACTOR_ARGS", environment);

  return {
    ...(cookiesFromBrowser
      ? { cookiesFromBrowser }
      : { cookies: getOptionalEnv("YOUTUBE_COOKIES_PATH", environment) ?? "./cookies.txt" }),
    ...(extractorArgs ? { extractorArgs } : {}),
  };
};

export const getS3Config = (environment: Environment = Bun.env) => ({
  endpoint: getOptionalEnv("S3_ENDPOINT", environment),
  bucket: getOptionalEnv("S3_BUCKET", environment),
  accessKey: getOptionalEnv("S3_ACCESS_KEY", environment),
  secretKey: getOptionalEnv("S3_SECRET_KEY", environment),
});

export const getValidatedS3Config = (environment: Environment = Bun.env): S3Config | null => {
  const config = getS3Config(environment);
  const entries = Object.entries(config);
  const configuredEntries = entries.filter(([, value]) => value !== undefined);

  if (configuredEntries.length === 0) {
    return null;
  }

  const missingVariables = entries.filter(([, value]) => value === undefined).map(([name]) => name);
  if (missingVariables.length > 0) {
    const envNames: Record<keyof S3Config, string> = {
      endpoint: "S3_ENDPOINT",
      bucket: "S3_BUCKET",
      accessKey: "S3_ACCESS_KEY",
      secretKey: "S3_SECRET_KEY",
    };
    const missingEnvNames = missingVariables.map((name) => envNames[name as keyof S3Config]);
    throw new Error(`Incomplete S3 configuration. Missing: ${missingEnvNames.join(", ")}`);
  }

  return config as S3Config;
};

export const isS3Configured = (environment: Environment = Bun.env) => getValidatedS3Config(environment) !== null;

export const getBotToken = (environment: Environment = Bun.env) => getOptionalEnv("TELEGRAM_BOT_TOKEN", environment);

export const requireEnv = (name: string, environment: Environment = Bun.env): string => {
  const value = getOptionalEnv(name, environment);
  if (!value) {
    throw new Error(`${name} is missing`);
  }
  return value;
};

export const normalizeServerUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("SERVER_URL must be a valid absolute URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SERVER_URL must use http or https");
  }

  return value.replace(/\/+$/, "");
};

export const getRequiredServerUrl = (environment: Environment = Bun.env) =>
  normalizeServerUrl(isTestEnv(environment) ? "https://test.com" : requireEnv("SERVER_URL", environment));

export const getRequiredBotToken = (environment: Environment = Bun.env) =>
  requireEnv("TELEGRAM_BOT_TOKEN", environment);

export const parseInteger = (value: string): number => {
  const normalizedValue = value.trim();
  if (!/^-?\d+$/.test(normalizedValue)) {
    return Number.NaN;
  }

  return Number.parseInt(normalizedValue, 10);
};

export const getPort = (environment: Environment = Bun.env) => {
  const port = parseInteger(environment.PORT ?? "3000");
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("PORT must be an integer between 0 and 65535");
  }
  return port;
};

export const getLogLevel = (environment: Environment = Bun.env): LogLevel => {
  const logLevel = getOptionalEnv("LOG_LEVEL", environment) ?? "info";
  if (!["debug", "info", "warn", "error"].includes(logLevel)) {
    throw new Error("LOG_LEVEL must be one of: debug, info, warn, error");
  }
  return logLevel as LogLevel;
};

export const parseIntegerList = (value?: string | null): number[] => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => parseInteger(item))
    .filter((item) => !Number.isNaN(item));
};

export const getTelegramWhitelist = (environment: Environment = Bun.env) => {
  const envWhitelist = parseIntegerList(environment.TELEGRAM_WHITELIST);
  if (envWhitelist.length === 0) {
    throw new Error("TELEGRAM_WHITELIST environment variable must be set with at least one valid Telegram user ID");
  }
  return envWhitelist;
};

export const loadAppConfig = (environment: Environment = Bun.env): AppConfig => ({
  serverUrl: getRequiredServerUrl(environment),
  rssFilePath: getRssFilePath(environment),
  filesDir: getFilesDir(environment),
  dbFileName: getDbFileName(environment),
  youtubeDownloadTimeoutMs: getYoutubeDownloadTimeoutMs(environment),
  youtubeDlAuthOptions: getYoutubeDlAuthOptions(environment),
  s3: getValidatedS3Config(environment),
});

export const loadBotAppConfig = (environment: Environment = Bun.env): BotAppConfig => ({
  ...loadAppConfig(environment),
  botToken: getRequiredBotToken(environment),
  telegramWhitelist: getTelegramWhitelist(environment),
});

export const loadServerAppConfig = (environment: Environment = Bun.env): ServerAppConfig => ({
  port: getPort(environment),
  logLevel: getLogLevel(environment),
});
