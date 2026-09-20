import { dirname, join } from "node:path";

import { collectionRepository } from "./collections.ts";
import type { CollectionRepository } from "./collections.ts";
import { getRssFilePath } from "./config.ts";
import { generateFeed } from "./generate-feed.ts";
import type { GenerateFeedOptions } from "./generate-feed.ts";
import type { Video } from "./types.ts";

export const createFeedPublisher =
  (
    collections: CollectionRepository = collectionRepository,
    render: typeof generateFeed = generateFeed,
    options: GenerateFeedOptions = {},
  ) =>
  async (videos: Video[]) => {
    const rssFilePath = options.rssFilePath ?? getRssFilePath();
    await render(videos, { ...options, rssFilePath });
    for (const collection of collections.list()) {
      const feedPath = `feeds/${collection.id}.xml`;
      await render(collections.videos(collection.id), {
        ...options,
        title: collection.name,
        feedPath,
        rssFilePath: join(dirname(rssFilePath), feedPath),
      });
    }
  };
export const publishFeeds = createFeedPublisher();
