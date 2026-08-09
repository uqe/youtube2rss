import { videoRepository } from "./db.ts";
import type { StoredVideo } from "./db.ts";
import { generateFeed } from "./generate-feed.ts";
import { logger } from "./logger.ts";
import { getStorage } from "./storage.ts";
import type { Storage } from "./storage.ts";
import { mediaTaskQueue } from "./task-queue.ts";
import type { TaskQueue } from "./task-queue.ts";
import type { Video } from "./types.ts";

interface AdminLogger {
  error(message: string): void;
}

export interface AdminRepository {
  list(): Video[];
  findById(videoId: string): StoredVideo | null;
  markDeleted(videoId: string): void;
  markActive(videoId: string): void;
}

export interface AdminService {
  listVideos(): Video[];
  deleteVideo(videoId: string): Promise<StoredVideo>;
}

export class AdminVideoNotFoundError extends Error {
  constructor(videoId: string) {
    super(`Video ${videoId} was not found`);
    this.name = "AdminVideoNotFoundError";
  }
}

export interface AdminServiceOptions {
  repository?: AdminRepository;
  storage?: Storage;
  feedGenerator?: (videos: Video[]) => Promise<void>;
  enqueue?: TaskQueue;
  log?: AdminLogger;
}

const getTimestamp = (video: Video) => {
  const timestamp = Date.parse(video.video_added_date);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const createAdminService = ({
  repository = videoRepository,
  storage,
  feedGenerator = generateFeed,
  enqueue = mediaTaskQueue,
  log = logger,
}: AdminServiceOptions = {}): AdminService => ({
  listVideos() {
    return repository.list().toSorted((left, right) => getTimestamp(right) - getTimestamp(left));
  },
  deleteVideo(videoId) {
    return enqueue(async () => {
      const video = repository.findById(videoId);
      if (!video) {
        throw new AdminVideoNotFoundError(videoId);
      }

      const wasDeleted = video.is_deleted;
      if (!wasDeleted) {
        repository.markDeleted(videoId);
      }

      try {
        await feedGenerator(repository.list());
      } catch (error) {
        if (!wasDeleted) {
          repository.markActive(videoId);
          try {
            await feedGenerator(repository.list());
          } catch (rollbackError) {
            log.error(`Failed to restore RSS after deleting ${videoId}: ${String(rollbackError)}`);
          }
        }
        throw error;
      }

      await (storage ?? getStorage()).deleteEpisodeAssets(
        videoId,
        video.video_path,
        video.video_artwork_path,
        video.video_chapters_path,
      );
      return { ...video, is_deleted: true };
    });
  },
});

export const adminService = createAdminService();
