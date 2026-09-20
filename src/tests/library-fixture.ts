import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCollectionRepository } from "../collections.ts";
import { createDatabaseFactory, createDb, createVideoRepository } from "../db.ts";
import { createJobRepository } from "../jobs.ts";
import type { Video } from "../types.ts";

export const sampleVideo: Video = {
  video_id: "dQw4w9WgXcQ",
  video_name: "Test episode",
  video_description: null,
  video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  video_added_date: "2026-01-01",
  video_path: "/test/audio.mp3",
  video_length: 100,
};
export const createTestLibrary = async () => {
  const directory = await mkdtemp(join(tmpdir(), "youtube2rss-tests-"));
  const dbFactory = createDatabaseFactory(() => join(directory, "library.db"));
  await createDb({ dbFactory, isTestEnvironment: () => true });
  return {
    directory,
    dbFactory,
    videos: createVideoRepository({ dbFactory }),
    jobs: createJobRepository({ dbFactory }),
    collections: createCollectionRepository(dbFactory),
    dispose: () => rm(directory, { recursive: true, force: true }),
  };
};
