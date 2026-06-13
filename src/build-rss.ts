import { getRequiredServerUrl } from "./config.ts";
import { videoRepository } from "./db.ts";
import { generateFeed } from "./generate-feed.ts";

export const buildRss = async () => {
  getRequiredServerUrl();
  console.log("Building RSS feed...");
  await generateFeed(videoRepository.list());
  console.log("RSS feed built.");
};

if (import.meta.main) {
  await buildRss();
}
