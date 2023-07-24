import { getAllVideos } from "./db.ts";
import { generateFeed } from "./generate-feed.ts";

console.log("Building RSS feed...");
generateFeed(getAllVideos());
console.log("RSS feed built.");
