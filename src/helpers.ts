import youtubedl, { type Payload } from "youtube-dl-exec";
import { getFilesDir, isS3Configured as isS3ConfiguredConfig } from "./config.ts";

export const getYoutubeVideoId = (message: string) => {
  const regex =
    /^https?:\/\/(?:(?:youtu\.be\/)|(?:(?:www\.)?youtube\.com\/(?:(?:watch\?(?:[^&]+&)?vi?=)|(?:vi?\/)|(?:shorts\/))))([a-zA-Z0-9_-]{11,})/gim;

  const res = regex.exec(message);
  return res?.[1] || null;
};

export const isS3Configured = () => isS3ConfiguredConfig();

export const getFilePath = (videoId: string, format: "mp3" | "mp4") => `${getFilesDir()}/${videoId}.${format}`;

export const formatSeconds = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
};

export const getVideoInfo = async (videoId: string): Promise<Payload> => {
  const info = await youtubedl(`https://youtu.be/watch?v=${videoId}`, {
    dumpSingleJson: true,
    noCheckCertificates: true,
    noWarnings: true,
    preferFreeFormats: true,
    cookies: "./cookies.txt",
    addHeader: ["referer:youtube.com", "user-agent:googlebot"],
  });

  if (typeof info === "string") {
    throw new Error("Failed to fetch video info");
  }

  return info as Payload;
};
