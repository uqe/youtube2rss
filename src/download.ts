import { getYoutubeDlAuthOptions, getYoutubeDownloadTimeoutMs, isTestEnv } from "./config.ts";
import { videoRepository } from "./db.ts";
import { generateFeed } from "./generate-feed.ts";
import { getFilePath, getVideoInfo, getYoutubeVideoUrl } from "./helpers.ts";
import { logger } from "./logger.ts";
import { getStorage, type Storage } from "./storage.ts";
import type { Video } from "./types.ts";
import type { Message } from "grammy/types";
import youtubedl, { type Payload } from "youtube-dl-exec";

interface DownloadRepository {
  create(video: Video): void;
  list(): Video[];
  exists(videoId: string): boolean;
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
  isTestEnv(): boolean;
  now(): Date;
  logger: DownloadLogger;
}

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

const saveVideoInfo = async (repository: DownloadRepository, info: Payload, outputFilePath: string, addedAt: Date) => {
  repository.create(createVideoFromInfo(info, outputFilePath, addedAt));
};

const refreshFeed = async (repository: DownloadRepository, feedGenerator: (videos: Video[]) => Promise<void>) => {
  await feedGenerator(repository.list());
};

const defaultDependencies: DownloadDependencies = {
  repository: videoRepository,
  downloadAudio,
  getVideoInfo,
  generateFeed,
  getFilePath,
  getStorage,
  isTestEnv,
  now: () => new Date(),
  logger,
};

export const createDownloader = (dependencies: Partial<DownloadDependencies> = {}) => {
  const deps = { ...defaultDependencies, ...dependencies };

  return async (videoId: string, handler?: ReplyHandler) => {
    const outputFilePath = deps.getFilePath(videoId, "mp3");

    try {
      if (deps.repository.exists(videoId)) {
        deps.logger.info("Video already exists");
        await handler?.("Video already exists. Find it in the RSS feed.");
        return;
      }

      deps.logger.info("Start downloading");
      await deps.downloadAudio(videoId, outputFilePath);

      deps.logger.success("Downloaded successfully");

      const downloadedFile = Bun.file(outputFilePath);
      const fileExists = await downloadedFile.exists();
      const fileSize = fileExists ? downloadedFile.size : 0;

      if (!fileExists || fileSize === 0) {
        const errorMsg = `Downloaded file is ${!fileExists ? "missing" : "empty"}: ${outputFilePath} for video ${videoId}`;
        deps.logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      const info = await deps.getVideoInfo(videoId);

      if (!deps.isTestEnv()) {
        const storage = deps.getStorage();
        await storage.uploadAudio(videoId, outputFilePath);
      }

      await saveVideoInfo(deps.repository, info, outputFilePath, deps.now());

      deps.logger.info("Start regenerating RSS feed");
      await refreshFeed(deps.repository, deps.generateFeed);
      deps.logger.success("Feed regenerated successfully");
      await handler?.("RSS feed was successfully updated.");
    } catch (error) {
      await handler?.("Something went wrong. Please try again later...");
      deps.logger.error("Download failed");
      console.error(error);
    }
  };
};

export const download = createDownloader();
