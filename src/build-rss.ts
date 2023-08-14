import { getAllVideos } from "./db.ts";
import { generateFeed } from "./generate-feed.ts";

if (!Deno.env.get("SERVER_URL")) {
  console.error("SERVER_URL variable is missing.");
  Deno.exit(1);
}

console.log("Building RSS feed...");
generateFeed(getAllVideos());
console.log("RSS feed built.");
