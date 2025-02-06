import type { Message } from "grammy/types";
import youtubedl, { type Payload } from "youtube-dl-exec";
import { addVideoToDb, getAllVideos, isVideoExists } from "./db.ts";
import { generateFeed } from "./generate-feed.ts";
import { getVideoInfo, isS3Configured } from "./helpers.ts";
import { uploadFileOnS3 } from "./s3.ts";

export const download = async (videoId: string, handler?: (text: string) => Promise<Message.TextMessage>) => {
  const outputFilePath = `./public/files/${videoId}.mp3`;

  try {
    if (isVideoExists(videoId)) {
      console.log("Video already exists");
      handler && handler("Video already exists. Find it in the RSS feed.");
      return;
    }

    console.log("Start downloading");

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
          quiet: false,
          embedThumbnail: true,
          // addHeader: ["referer:youtube.com", "user-agent:googlebot"],
        },
        { timeout: 100000, killSignal: "SIGKILL" }
      )
      .catch((err) => err);

    console.log("Downloaded successfully");

    const info: Payload = await getVideoInfo(videoId);

    if (isS3Configured() && !Bun.env.IS_TEST) {
      await uploadFileOnS3(videoId, outputFilePath);
    }

    await addVideoToDb(
      info.id,
      info.title,
      info.description,
      info.webpage_url,
      new Date().toISOString(),
      outputFilePath,
      info.duration
    );

    console.log("Start regenerating RSS feed");
    generateFeed(getAllVideos());
    console.log("Feed regenerated successfully");
    handler && handler("RSS feed was successfully updated.");
  } catch (error) {
    handler && handler("Something went wrong. Please try again later...");
    console.error(error);
  }
};
