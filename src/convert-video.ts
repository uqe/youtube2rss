import { addVideoToDb } from "./db.ts";
import { exists, FfmpegClass, Message, VideoInfo } from "./deps.ts";
import { generateFeed } from "./generate-feed.ts";

const updateDb = async (info: VideoInfo) => {
  await addVideoToDb(
    info.videoDetails.videoId,
    info.videoDetails.title,
    info.videoDetails.description,
    info.videoDetails.video_url,
    new Date().toISOString(),
    `./public/files/${info.videoDetails.videoId}.mp3`,
    info.videoDetails.lengthSeconds,
  );
};

export const convertVideo = async (info: VideoInfo, handler?: (text: string) => Promise<Message.TextMessage>) => {
  const { videoId } = info.videoDetails;

  const ffmpeg = new FfmpegClass({
    input: `./public/files/${videoId}.mp4`,
    // ffmpegDir: "/opt/homebrew/bin/ffmpeg"
    ffmpegDir: "ffmpeg",
  });

  console.log("Conversion started!");
  await ffmpeg.audioBitrate(128).save(`./public/files/${videoId}.mp3`);
  console.log("Conversion ended successfully");
  await updateDb(info);

  if (await exists(`./public/files/${videoId}.mp4`)) {
    Deno.remove(`./public/files/${videoId}.mp4`);
  }

  console.log("Start regenerating RSS feed");
  generateFeed();
  console.log("Feed regenerated successfully");
  handler && handler("RSS feed was successfully updated.");
};
