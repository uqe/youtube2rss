import { expect, it } from "bun:test";
import { execPath } from "node:process";

it("should isolate application defaults from inherited production configuration", async () => {
  const process = Bun.spawn({
    cmd: [
      execPath,
      "--no-env-file",
      "--preload",
      `${import.meta.dir}/setup.ts`,
      "--eval",
      `
        const { loadAppConfig, loadServerAppConfig, getBotToken } = await import('./src/config.ts');
        const { getStorage } = await import('./src/storage.ts');
        console.log(JSON.stringify({
          app: loadAppConfig(),
          server: loadServerAppConfig(),
          hasBotToken: Boolean(getBotToken()),
          hasWhitelist: Boolean(Bun.env.TELEGRAM_WHITELIST),
          storage: getStorage().kind,
        }));
      `,
    ],
    cwd: `${import.meta.dir}/../..`,
    env: {
      ...Bun.env,
      IS_TEST: "false",
      S3_ENDPOINT: "https://storage.invalid",
      S3_BUCKET: "production",
      S3_ACCESS_KEY: "test-access-key",
      S3_SECRET_KEY: "test-secret-key",
      SERVER_URL: "invalid",
      TELEGRAM_BOT_TOKEN: "test-token",
      TELEGRAM_WHITELIST: "12345",
      ADMIN_PASSWORD: "test-password",
      PORT: "invalid",
      LOG_LEVEL: "invalid",
      YOUTUBE_DOWNLOAD_TIMEOUT_MS: "invalid",
      YOUTUBE_COOKIES_FROM_BROWSER: "chrome",
      YOUTUBE_COOKIES_PATH: "/production/cookies.txt",
      YOUTUBE_EXTRACTOR_ARGS: "production-args",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);

  expect(stderr).toBe("");
  expect(exitCode).toBe(0);
  expect(JSON.parse(stdout)).toMatchObject({
    app: {
      serverUrl: "https://test.com",
      dbFileName: "youtube2rss.test.db",
      s3: null,
      youtubeDlAuthOptions: { cookies: "./cookies.txt" },
    },
    server: { port: 3000, logLevel: "info" },
    hasBotToken: false,
    hasWhitelist: false,
    storage: "local",
  });
  expect(JSON.parse(stdout).app.youtubeDlAuthOptions).toEqual({ cookies: "./cookies.txt" });
  expect(JSON.parse(stdout).server).not.toHaveProperty("adminPassword");
});
