import { getAllVideos } from "./db.ts";
import { generateFeed } from "./generate-feed.ts";

if (!Bun.env.SERVER_URL) {
  console.error("SERVER_URL variable is missing.");
  process.exit(1);
}

const buildRss = async () => {
  console.log("Building RSS feed...");
  await generateFeed(getAllVideos());
  console.log("RSS feed built.");
};

buildRss();
