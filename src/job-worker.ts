import { createAdminService } from "./admin.ts";
import { collectionRepository } from "./collections.ts";
import type { CollectionRepository } from "./collections.ts";
import { videoRepository } from "./db.ts";
import type { VideoRepository } from "./db.ts";
import { createDownloader } from "./download.ts";
import type { DownloadProgressHandler, DownloadResult } from "./download.ts";
import { jobRepository } from "./jobs.ts";
import type { JobRepository } from "./jobs.ts";
import { logger } from "./logger.ts";
import { createFeedPublisher } from "./publish-feeds.ts";
import type { Video } from "./types.ts";

interface WorkerOptions {
  jobs?: JobRepository;
  videos?: VideoRepository;
  collections?: CollectionRepository;
  downloadVideo?: (videoId: string, progress: DownloadProgressHandler) => Promise<DownloadResult>;
  deleteVideo?: (videoId: string) => Promise<unknown>;
  publish?: (videos: Video[]) => Promise<void>;
  log?: Pick<typeof logger, "error">;
  retryDelayMs?: number;
}
export const createJobWorker = ({
  jobs = jobRepository,
  videos = videoRepository,
  collections = collectionRepository,
  downloadVideo,
  deleteVideo,
  publish = createFeedPublisher(collections),
  log = logger,
  retryDelayMs = 30_000,
}: WorkerOptions = {}) => {
  const downloader = createDownloader({ repository: videos, generateFeed: publish });
  const processDownload =
    downloadVideo ?? ((videoId: string, progress: DownloadProgressHandler) => downloader(videoId, undefined, progress));
  const processDeletion = deleteVideo ?? createAdminService({ repository: videos, feedGenerator: publish }).deleteVideo;
  const owner = crypto.randomUUID();
  let running = false;
  return {
    async runOnce(): Promise<boolean> {
      if (running) {
        return false;
      }
      running = true;
      try {
        const job = jobs.claim(owner);
        if (!job) {
          return false;
        }
        let result = "updated";
        try {
          if (job.kind === "download" && job.videoId) {
            const downloaded = await processDownload(job.videoId, (progress) =>
              jobs.progress(
                job.id,
                owner,
                progress.stage === "completed"
                  ? { stage: "publish-feed", percent: 97, message: "Publishing feeds" }
                  : progress,
              ),
            );
            result = downloaded.status;
            if (result !== "failed" && job.collectionId) {
              collections.add(job.collectionId, job.videoId);
              await publish(videos.list());
            }
          } else if (job.kind === "delete" && job.videoId) {
            await processDeletion(job.videoId);
            result = "deleted";
          } else if (
            (job.kind === "collection-add" || job.kind === "collection-remove") &&
            job.videoId &&
            job.collectionId
          ) {
            if (!collections.get(job.collectionId)) {
              throw new Error("Collection no longer exists");
            }
            const video = videos.findById(job.videoId);
            if (!video || video.is_deleted) {
              throw new Error("Episode no longer exists");
            }
            if (job.kind === "collection-add") {
              collections.add(job.collectionId, job.videoId);
            } else {
              collections.remove(job.collectionId, job.videoId);
            }
            await publish(videos.list());
          } else if (job.kind === "refresh") {
            await publish(videos.list());
          } else {
            throw new Error("Invalid job payload");
          }
        } catch (error) {
          log.error(`Job ${job.id} (${job.kind}) failed: ${String(error)}`);
          result = "failed";
        }
        jobs.finish(
          job.id,
          owner,
          result,
          result === "failed" && job.attempts < 3 ? retryDelayMs * job.attempts : undefined,
        );
        return true;
      } finally {
        running = false;
      }
    },
  };
};
