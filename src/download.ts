import { getYoutubeDlAuthOptions, getYoutubeDownloadTimeoutMs } from "./config.ts";
import { videoRepository } from "./db.ts";
import type { PublicationStatus } from "./db.ts";
import { downloadEpisodeArtwork } from "./episode-artwork.ts";
import { writeEpisodeChapters } from "./episode-chapters.ts";
import { generateFeed } from "./generate-feed.ts";
import { getArtworkPath, getChaptersPath, getFilePath, getVideoInfo, getYoutubeVideoUrl } from "./helpers.ts";
import { logger } from "./logger.ts";
import { getStorage, type Storage } from "./storage.ts";
import { createSerialTaskQueue, mediaTaskQueue } from "./task-queue.ts";
import type { TaskQueue } from "./task-queue.ts";
import type { Video } from "./types.ts";
import type { Message } from "grammy/types";
import youtubedl, { type Payload } from "youtube-dl-exec";

interface DownloadRepository {
  create(video: Video, publicationStatus?: PublicationStatus): void;
  list(): Video[];
  getPublicationStatus(videoId: string): PublicationStatus | null;
  markPublished(videoId: string): void;
}

interface DownloadLogger {
  info(message: string): void;
  success(message: string): void;
  error(message: string): void;
}

type ReplyHandler = (text: string) => Promise<Message.TextMessage> | void;

interface YoutubeDlExecutor {
  exec(url: string, options: Record<string, unknown>, executionOptions: Record<string, unknown>): Promise<unknown>;
}

export interface DownloadDependencies {
  repository: DownloadRepository;
  downloadAudio(videoId: string, outputFilePath: string): Promise<void>;
  downloadArtwork(thumbnailUrl: string, outputFilePath: string): Promise<void>;
  writeChapters(videoInfo: unknown, outputFilePath: string): Promise<boolean>;
  getVideoInfo(videoId: string): Promise<Payload>;
  generateFeed(videos: Video[]): Promise<void>;
  getFilePath(videoId: string, format: "mp3" | "mp4"): string;
  getArtworkPath(videoId: string): string;
  getChaptersPath(videoId: string): string;
  getStorage(): Storage;
  deleteFile(filePath: string): Promise<void>;
  now(): Date;
  logger: DownloadLogger;
}

export type DownloadResult =
  | { status: "published" }
  | { status: "already-published" }
  | { status: "recovered" }
  | { status: "failed" };

export type DownloadProgressStage =
  | "queued"
  | "lookup"
  | "download"
  | "validate"
  | "metadata"
  | "chapters"
  | "artwork"
  | "upload-audio"
  | "upload-artwork"
  | "upload-chapters"
  | "persist"
  | "publish-feed"
  | "completed"
  | "failed";

export interface DownloadProgress {
  stage: DownloadProgressStage;
  percent: number;
  message: string;
}

export type DownloadProgressHandler = (progress: DownloadProgress) => void;

type ProcessingStage =
  | "lookup"
  | "download"
  | "validate"
  | "metadata"
  | "chapters"
  | "artwork"
  | "upload-audio"
  | "upload-artwork"
  | "upload-chapters"
  | "persist"
  | "publish-feed"
  | "notify";

const stageProgress: Record<Exclude<ProcessingStage, "notify">, Omit<DownloadProgress, "stage">> = {
  lookup: { percent: 5, message: "Checking the episode" },
  download: { percent: 12, message: "Downloading and converting audio" },
  validate: { percent: 48, message: "Verifying the audio file" },
  metadata: { percent: 54, message: "Reading video metadata" },
  chapters: { percent: 58, message: "Preparing episode chapters" },
  artwork: { percent: 64, message: "Preparing episode artwork" },
  "upload-audio": { percent: 72, message: "Uploading audio" },
  "upload-artwork": { percent: 80, message: "Uploading artwork" },
  "upload-chapters": { percent: 86, message: "Uploading chapters" },
  persist: { percent: 92, message: "Saving the episode" },
  "publish-feed": { percent: 97, message: "Publishing the RSS feed" },
};

export const createAudioDownloader = (
  executor: YoutubeDlExecutor = youtubedl,
  timeoutMs = getYoutubeDownloadTimeoutMs()
) => {
  return async (videoId: string, outputFilePath: string) => {
    await executor.exec(
      getYoutubeVideoUrl(videoId),
      {
        format: "bestaudio[ext=m4a]/bestaudio/best",
        extractAudio: true,
        audioFormat: "mp3",
        noCheckCertificates: true,
        noWarnings: true,
        output: outputFilePath,
        preferFreeFormats: true,
        writeInfoJson: false,
        ...getYoutubeDlAuthOptions(),
        quiet: false,
        embedThumbnail: true,
        embedChapters: true,
        // addHeader: ["referer:youtube.com", "user-agent:googlebot"],
      },
      { timeout: timeoutMs, killSignal: "SIGKILL" }
    );
  };
};

const downloadAudio = createAudioDownloader();

export const createVideoFromInfo = (
  info: Payload,
  outputFilePath: string,
  addedAt: Date,
  artworkFilePath: string | null = null,
  chaptersFilePath: string | null = null
): Video => ({
  video_id: info.id,
  video_name: info.title,
  video_description: info.description,
  video_url: info.webpage_url,
  video_added_date: addedAt.toISOString(),
  video_path: outputFilePath,
  video_artwork_path: artworkFilePath,
  video_chapters_path: chaptersFilePath,
  video_length: info.duration,
});

const refreshFeed = async (repository: DownloadRepository, feedGenerator: (videos: Video[]) => Promise<void>) => {
  await feedGenerator(repository.list());
};

const deleteFile = async (filePath: string) => {
  const file = Bun.file(filePath);
  if (await file.exists()) {
    await file.delete();
  }
};

const formatError = (error: unknown) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error));

const formatLogEvent = (event: string, videoId: string, stage: ProcessingStage, error?: unknown) =>
  JSON.stringify({
    event,
    videoId,
    stage,
    ...(error === undefined ? {} : { error: formatError(error) }),
  });

const defaultDependencies: DownloadDependencies = {
  repository: videoRepository,
  downloadAudio,
  downloadArtwork: downloadEpisodeArtwork,
  writeChapters: writeEpisodeChapters,
  getVideoInfo,
  generateFeed,
  getFilePath,
  getArtworkPath,
  getChaptersPath,
  getStorage,
  deleteFile,
  now: () => new Date(),
  logger,
};

export const createDownloader = (
  dependencies: Partial<DownloadDependencies> = {},
  enqueue: TaskQueue = createSerialTaskQueue()
) => {
  const deps = { ...defaultDependencies, ...dependencies };

  const processVideo = async (videoId: string, progressHandler?: DownloadProgressHandler): Promise<DownloadResult> => {
    let outputFilePath: string | undefined;
    let artworkFilePath: string | undefined;
    let chaptersFilePath: string | undefined;
    let storage: Storage | undefined;
    let uploadStarted = false;
    let isPersisted = false;
    let stage: ProcessingStage = "lookup";
    let progressPercent = 0;

    const reportProgress = (progress: DownloadProgress) => {
      progressPercent = progress.percent;
      try {
        progressHandler?.(progress);
      } catch (error) {
        deps.logger.error(formatLogEvent("progress_notification_failed", videoId, stage, error));
      }
    };

    const updateStage = (nextStage: Exclude<ProcessingStage, "notify">) => {
      stage = nextStage;
      reportProgress({ stage: nextStage, ...stageProgress[nextStage] });
    };

    try {
      updateStage("lookup");
      const publicationStatus = deps.repository.getPublicationStatus(videoId);

      if (publicationStatus === "published") {
        deps.logger.info(formatLogEvent("video_already_published", videoId, stage));
        reportProgress({ stage: "completed", percent: 100, message: "Episode already published" });
        return { status: "already-published" };
      }

      if (publicationStatus === "pending") {
        updateStage("validate");
        const pendingVideo = deps.repository.list().find((video) => video.video_id === videoId);
        if (!pendingVideo) {
          throw new Error(`Pending publication has no database record for video ${videoId}`);
        }

        const audio = await deps.getStorage().getAudioMetadata(videoId, pendingVideo.video_path);
        if (!audio.exists || audio.size === 0) {
          throw new Error(`Pending publication has no usable audio for video ${videoId}`);
        }

        if (pendingVideo.video_artwork_path) {
          const artwork = await deps.getStorage().getArtworkMetadata(videoId, pendingVideo.video_artwork_path);
          if (!artwork.exists) {
            throw new Error(`Pending publication has no artwork for video ${videoId}`);
          }
        }

        if (pendingVideo.video_chapters_path) {
          const chapters = await deps.getStorage().getChaptersMetadata(videoId, pendingVideo.video_chapters_path);
          if (!chapters.exists) {
            throw new Error(`Pending publication has no chapters for video ${videoId}`);
          }
        }

        updateStage("publish-feed");
        deps.logger.info(formatLogEvent("feed_publication_retry", videoId, stage));
        await refreshFeed(deps.repository, deps.generateFeed);
        deps.repository.markPublished(videoId);
        deps.logger.success(formatLogEvent("feed_publication_recovered", videoId, stage));
        reportProgress({ stage: "completed", percent: 100, message: "Episode publication recovered" });
        return { status: "recovered" };
      }

      outputFilePath = deps.getFilePath(videoId, "mp3");

      updateStage("download");
      deps.logger.info(formatLogEvent("video_download_started", videoId, stage));
      await deps.downloadAudio(videoId, outputFilePath);

      deps.logger.success(formatLogEvent("video_download_completed", videoId, stage));

      updateStage("validate");
      const downloadedFile = Bun.file(outputFilePath);
      const fileExists = await downloadedFile.exists();
      const fileSize = fileExists ? downloadedFile.size : 0;

      if (!fileExists || fileSize === 0) {
        const errorMsg = `Downloaded file is ${!fileExists ? "missing" : "empty"}: ${outputFilePath} for video ${videoId}`;
        deps.logger.error(formatLogEvent("downloaded_file_invalid", videoId, stage, errorMsg));
        throw new Error(errorMsg);
      }

      updateStage("metadata");
      const info = await deps.getVideoInfo(videoId);

      if (!info.thumbnail) {
        throw new Error(`Video ${videoId} has no thumbnail`);
      }

      updateStage("chapters");
      chaptersFilePath = deps.getChaptersPath(videoId);
      const hasChapters = await deps.writeChapters(info, chaptersFilePath);
      if (!hasChapters) {
        chaptersFilePath = undefined;
      }

      updateStage("artwork");
      artworkFilePath = deps.getArtworkPath(videoId);
      await deps.downloadArtwork(info.thumbnail, artworkFilePath);
      const artworkFile = Bun.file(artworkFilePath);
      if (!(await artworkFile.exists()) || artworkFile.size === 0) {
        throw new Error(`Prepared artwork is missing or empty for video ${videoId}`);
      }

      updateStage("upload-audio");
      storage = deps.getStorage();
      uploadStarted = true;
      await storage.uploadAudio(videoId, outputFilePath);

      updateStage("upload-artwork");
      await storage.uploadArtwork(videoId, artworkFilePath);

      if (chaptersFilePath) {
        updateStage("upload-chapters");
        await storage.uploadChapters(videoId, chaptersFilePath);
      }

      updateStage("persist");
      deps.repository.create(
        createVideoFromInfo(info, outputFilePath, deps.now(), artworkFilePath, chaptersFilePath),
        "pending"
      );
      isPersisted = true;

      updateStage("publish-feed");
      deps.logger.info(formatLogEvent("feed_publication_started", videoId, stage));
      await refreshFeed(deps.repository, deps.generateFeed);
      deps.repository.markPublished(videoId);
      deps.logger.success(formatLogEvent("feed_publication_completed", videoId, stage));
      reportProgress({ stage: "completed", percent: 100, message: "Episode published" });
      return { status: "published" };
    } catch (error) {
      if (!isPersisted) {
        try {
          if (uploadStarted && storage && outputFilePath) {
            await storage.deleteEpisodeAssets(videoId, outputFilePath, artworkFilePath, chaptersFilePath);
          } else {
            await Promise.all(
              [outputFilePath, artworkFilePath, chaptersFilePath]
                .filter((filePath): filePath is string => Boolean(filePath))
                .map((filePath) => deps.deleteFile(filePath))
            );
          }
        } catch (cleanupError) {
          deps.logger.error(formatLogEvent("download_cleanup_failed", videoId, stage, cleanupError));
        }
      }

      reportProgress({ stage: "failed", percent: progressPercent, message: "Episode processing failed" });
      deps.logger.error(formatLogEvent("video_processing_failed", videoId, stage, error));
      return { status: "failed" };
    }
  };

  const notify = async (videoId: string, result: DownloadResult, handler?: ReplyHandler) => {
    if (!handler) return;

    const messages: Record<DownloadResult["status"], string> = {
      published: "RSS feed was successfully updated.",
      "already-published": "Video already exists. Find it in the RSS feed.",
      recovered: "RSS feed publication was successfully recovered.",
      failed: "Something went wrong. Please try again later...",
    };

    try {
      await handler(messages[result.status]);
    } catch (error) {
      deps.logger.error(formatLogEvent("download_notification_failed", videoId, "notify", error));
    }
  };

  return async (videoId: string, handler?: ReplyHandler, progressHandler?: DownloadProgressHandler) => {
    const result = await enqueue(() => processVideo(videoId, progressHandler));
    await notify(videoId, result, handler);
    return result;
  };
};

export const download = createDownloader({}, mediaTaskQueue);
