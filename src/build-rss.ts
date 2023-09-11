import { getAllVideos } from "./db.ts";
import { generateFeed } from "./generate-feed.ts";

if (!Deno.env.get("SERVER_URL")) {
  console.error("SERVER_URL variable is missing.");
  Deno.exit(1);
}

const buildRss = async () => {
  try {
    console.log("Building RSS feed...");
    await generateFeed(getAllVideos());
    console.log("RSS feed built.");
  } catch (error) {
    throw error;
  }
};

buildRss();
