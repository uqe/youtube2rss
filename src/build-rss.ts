import { getRequiredServerUrl } from "./config.ts";
import { videoRepository } from "./db.ts";
import { generateFeed } from "./generate-feed.ts";

getRequiredServerUrl();

const buildRss = async () => {
  console.log("Building RSS feed...");
  await generateFeed(videoRepository.list());
  console.log("RSS feed built.");
};

buildRss();
