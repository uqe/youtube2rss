export const isTestEnv = () => Bun.env.IS_TEST === "true";

export const getServerUrl = () => (isTestEnv() ? "https://test.com" : Bun.env.SERVER_URL);

export const getRssFilePath = () => (isTestEnv() ? "./public/rss.test.xml" : "./public/rss.xml");

export const getFilesDir = () => (isTestEnv() ? "./src/tests/data" : "./public/files");

export const getDbFileName = () => (isTestEnv() ? "youtube2rss.test.db" : "youtube2rss.db");

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

export const getPort = () => Number.parseInt(Bun.env.PORT ?? "3000", 10);

export const getLogLevel = () => Bun.env.LOG_LEVEL ?? "info";

const parseNumberList = (value?: string | null): number[] => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => !Number.isNaN(item));
};

export const getTelegramWhitelist = () => {
  const envWhitelist = parseNumberList(Bun.env.TELEGRAM_WHITELIST);
  return envWhitelist.length > 0 ? envWhitelist : [169125];
};
