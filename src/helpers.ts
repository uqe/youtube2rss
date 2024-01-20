import { addVideoToDb } from "./db.ts";
import { VideoInfo } from "./deps.ts";

export const getYoutubeVideoId = (message: string) => {
  const regex =
    /^https?:\/\/(?:(?:youtu\.be\/)|(?:(?:www\.)?youtube\.com\/(?:(?:watch\?(?:[^&]+&)?vi?=)|(?:vi?\/)|(?:shorts\/))))([a-zA-Z0-9_-]{11,})/gim;

  const res = regex.exec(message);
  return res && res[1];
};

export const isS3Configured = () => {
  return Boolean(
    Deno.env.get("S3_ENDPOINT") &&
      Deno.env.get("S3_BUCKET") &&
      Deno.env.get("S3_ACCESS_KEY") &&
      Deno.env.get("S3_SECRET_KEY"),
  );
};

export const getFilePath = (videoId: string, format: "mp3" | "mp4") =>
  Deno.env.get("IS_TEST") ? `./src/tests/data/${videoId}.${format}` : `./public/files/${videoId}.${format}`;

export const updateDb = async (info: VideoInfo) => {
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
