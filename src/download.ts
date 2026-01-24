import type { Message } from "grammy/types";
import youtubedl, { type Payload } from "youtube-dl-exec";
import { isTestEnv } from "./config.ts";
import { videoRepository } from "./db.ts";
import { generateFeed } from "./generate-feed.ts";
import { getFilePath, getVideoInfo } from "./helpers.ts";
import { logger } from "./logger.ts";
import { getStorage } from "./storage.ts";
import type { Video } from "./types.ts";

const downloadAudio = async (videoId: string, outputFilePath: string) => {
  await youtubedl
    .exec(
      `https://youtu.be/watch?v=${videoId}`,
      {
        extractAudio: true,
        audioFormat: "mp3",
        noCheckCertificates: true,
        noWarnings: true,
        output: outputFilePath,
        preferFreeFormats: true,
        writeInfoJson: false,
        cookies: "./cookies.txt",
        quiet: false,
        embedThumbnail: true,
        // addHeader: ["referer:youtube.com", "user-agent:googlebot"],
      },
      { timeout: 100000, killSignal: "SIGKILL" }
    )
    .catch((err) => err);
};

const saveVideoInfo = async (info: Payload, outputFilePath: string) => {
  const video: Video = {
    video_id: info.id,
    video_name: info.title,
    video_description: info.description,
    video_url: info.webpage_url,
    video_added_date: new Date().toISOString(),
    video_path: outputFilePath,
    video_length: info.duration,
  };

  videoRepository.create(video);
};

const refreshFeed = async () => {
  await generateFeed(videoRepository.list());
};

export const download = async (videoId: string, handler?: (text: string) => Promise<Message.TextMessage>) => {
  const outputFilePath = getFilePath(videoId, "mp3");
  const storage = getStorage();

  try {
    if (videoRepository.exists(videoId)) {
      logger.info("Video already exists");
      handler?.("Video already exists. Find it in the RSS feed.");
      return;
    }

    logger.info("Start downloading");
    await downloadAudio(videoId, outputFilePath);

    logger.success("Downloaded successfully");

    const info: Payload = await getVideoInfo(videoId);

    if (!isTestEnv()) {
      await storage.uploadAudio(videoId, outputFilePath);
    }

    await saveVideoInfo(info, outputFilePath);

    logger.info("Start regenerating RSS feed");
    await refreshFeed();
    logger.success("Feed regenerated successfully");
    handler?.("RSS feed was successfully updated.");
  } catch (error) {
    handler?.("Something went wrong. Please try again later...");
    logger.error("Download failed");
    console.error(error);
  }
};
