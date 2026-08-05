import { getYoutubeDlAuthOptions, getYoutubeDownloadTimeoutMs } from "./config.ts";
import { videoRepository } from "./db.ts";
import type { PublicationStatus } from "./db.ts";
import { generateFeed } from "./generate-feed.ts";
import { getFilePath, getVideoInfo, getYoutubeVideoUrl } from "./helpers.ts";
import { logger } from "./logger.ts";
import { getStorage, type Storage } from "./storage.ts";
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
  getVideoInfo(videoId: string): Promise<Payload>;
  generateFeed(videos: Video[]): Promise<void>;
  getFilePath(videoId: string, format: "mp3" | "mp4"): string;
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

type ProcessingStage =
  | "lookup"
  | "download"
  | "validate"
  | "metadata"
  | "upload-audio"
  | "persist"
  | "publish-feed"
  | "notify";

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
        // addHeader: ["referer:youtube.com", "user-agent:googlebot"],
      },
      { timeout: timeoutMs, killSignal: "SIGKILL" }
    );
  };
};

const downloadAudio = createAudioDownloader();

export const createVideoFromInfo = (info: Payload, outputFilePath: string, addedAt: Date): Video => ({
  video_id: info.id,
  video_name: info.title,
  video_description: info.description,
  video_url: info.webpage_url,
  video_added_date: addedAt.toISOString(),
  video_path: outputFilePath,
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

const createSerialTaskQueue = () => {
  let tail: Promise<unknown> = Promise.resolve();

  return <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task, task);
    tail = result.catch(() => undefined);
    return result;
  };
};

const defaultDependencies: DownloadDependencies = {
  repository: videoRepository,
  downloadAudio,
  getVideoInfo,
  generateFeed,
  getFilePath,
  getStorage,
  deleteFile,
  now: () => new Date(),
  logger,
};

export const createDownloader = (dependencies: Partial<DownloadDependencies> = {}) => {
  const deps = { ...defaultDependencies, ...dependencies };
  const enqueue = createSerialTaskQueue();

  const processVideo = async (videoId: string): Promise<DownloadResult> => {
    let outputFilePath: string | undefined;
    let isPersisted = false;
    let stage: ProcessingStage = "lookup";

    try {
      const publicationStatus = deps.repository.getPublicationStatus(videoId);

      if (publicationStatus === "published") {
        deps.logger.info(formatLogEvent("video_already_published", videoId, stage));
        return { status: "already-published" };
      }

      if (publicationStatus === "pending") {
        stage = "validate";
        const pendingVideo = deps.repository.list().find((video) => video.video_id === videoId);
        if (!pendingVideo) {
          throw new Error(`Pending publication has no database record for video ${videoId}`);
        }

        const audio = await deps.getStorage().getAudioMetadata(videoId, pendingVideo.video_path);
        if (!audio.exists || audio.size === 0) {
          throw new Error(`Pending publication has no usable audio for video ${videoId}`);
        }

        stage = "publish-feed";
        deps.logger.info(formatLogEvent("feed_publication_retry", videoId, stage));
        await refreshFeed(deps.repository, deps.generateFeed);
        deps.repository.markPublished(videoId);
        deps.logger.success(formatLogEvent("feed_publication_recovered", videoId, stage));
        return { status: "recovered" };
      }

      outputFilePath = deps.getFilePath(videoId, "mp3");

      stage = "download";
      deps.logger.info(formatLogEvent("video_download_started", videoId, stage));
      await deps.downloadAudio(videoId, outputFilePath);

      deps.logger.success(formatLogEvent("video_download_completed", videoId, stage));

      stage = "validate";
      const downloadedFile = Bun.file(outputFilePath);
      const fileExists = await downloadedFile.exists();
      const fileSize = fileExists ? downloadedFile.size : 0;

      if (!fileExists || fileSize === 0) {
        const errorMsg = `Downloaded file is ${!fileExists ? "missing" : "empty"}: ${outputFilePath} for video ${videoId}`;
        deps.logger.error(formatLogEvent("downloaded_file_invalid", videoId, stage, errorMsg));
        throw new Error(errorMsg);
      }

      stage = "metadata";
      const info = await deps.getVideoInfo(videoId);
      stage = "upload-audio";
      const storage = deps.getStorage();
      await storage.uploadAudio(videoId, outputFilePath);

      stage = "persist";
      deps.repository.create(createVideoFromInfo(info, outputFilePath, deps.now()), "pending");
      isPersisted = true;

      stage = "publish-feed";
      deps.logger.info(formatLogEvent("feed_publication_started", videoId, stage));
      await refreshFeed(deps.repository, deps.generateFeed);
      deps.repository.markPublished(videoId);
      deps.logger.success(formatLogEvent("feed_publication_completed", videoId, stage));
      return { status: "published" };
    } catch (error) {
      if (outputFilePath && !isPersisted) {
        try {
          await deps.deleteFile(outputFilePath);
        } catch (cleanupError) {
          deps.logger.error(formatLogEvent("download_cleanup_failed", videoId, stage, cleanupError));
        }
      }

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

  return async (videoId: string, handler?: ReplyHandler) => {
    const result = await enqueue(() => processVideo(videoId));
    await notify(videoId, result, handler);
    return result;
  };
};

export const download = createDownloader();
