import { loadAppConfig } from "./config.ts";
import { createDb, videoRepository } from "./db.ts";
import { generateFeed } from "./generate-feed.ts";

export const buildRss = async () => {
  const config = loadAppConfig();
  await createDb();
  console.log("Building RSS feed...");
  await generateFeed(videoRepository.list(), {
    baseUrl: config.serverUrl,
    rssFilePath: config.rssFilePath,
  });
  console.log("RSS feed built.");
};

if (import.meta.main) {
  await buildRss();
}
