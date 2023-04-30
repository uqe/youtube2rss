import { exists } from "https://deno.land/std/fs/mod.ts";
import { Message } from "https://deno.land/x/grammy_types@v3.0.3/message.ts";
import { VideoInfo } from "https://deno.land/x/ytdl_core@v0.1.2/src/types.ts";
import ffmpegInstaller from "npm:@ffmpeg-installer/ffmpeg";
import ffmpeg from "npm:fluent-ffmpeg";
import { addVideoToDb } from "./db.ts";
import { generateFeed } from "./generate-feed.ts";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const updateDb = async (info: VideoInfo) => {
  await addVideoToDb(
    info.videoDetails.videoId,
    info.videoDetails.title,
    info.videoDetails.description,
    info.videoDetails.video_url,
    new Date().toISOString().split("T")[0],
    `./public/files/${info.videoDetails.videoId}.mp3`,
    info.videoDetails.lengthSeconds,
  );
};

export const convertVideo = (info: VideoInfo, handler?: (text: string) => Promise<Message.TextMessage>) => {
  const { videoId } = info.videoDetails;

  ffmpeg(`./public/files/${videoId}.mp4`)
    .audioBitrate(128)
    .save(`./public/files/${videoId}.mp3`)
    .on("start", () => console.log("Conversion started!"))
    .on("end", async () => {
      console.log("Conversion ended successfully");
      updateDb(info);

      if (await exists(`./public/files/${videoId}.mp4`)) {
        Deno.remove(`./public/files/${videoId}.mp4`);
      }

      console.log("Start regenerating RSS feed");
      generateFeed();
      console.log("Feed regenerated successfully");
      handler && handler("RSS feed was successfully updated.");
    });
};
