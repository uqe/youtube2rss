import { getFilesDir, getYoutubeDlAuthOptions, isS3Configured as isS3ConfiguredConfig } from "./config.ts";
import youtubedl, { type Payload } from "youtube-dl-exec";

const videoIdPattern = /^[a-zA-Z0-9_-]{11,}$/;
const safeFileVideoIdPattern = /^[a-zA-Z0-9_-]+$/;
const urlPattern = /https?:\/\/[^\s<>"']+/gi;

const trimTrailingPunctuation = (value: string) => value.replace(/[),.!?;:]+$/g, "");

const isYoutubeHost = (hostname: string) => hostname === "youtube.com" || hostname.endsWith(".youtube.com");

const getPathVideoId = (url: URL, pathPrefixes: string[]) => {
  const [prefix, videoId] = url.pathname.split("/").filter(Boolean);

  if (!prefix || !videoId || !pathPrefixes.includes(prefix)) {
    return null;
  }

  return videoIdPattern.test(videoId) ? videoId : null;
};

const getVideoIdFromUrl = (url: URL) => {
  const hostname = url.hostname.toLowerCase();

  if (hostname === "youtu.be") {
    const videoId = url.pathname.split("/").filter(Boolean)[0];
    return videoId && videoIdPattern.test(videoId) ? videoId : null;
  }

  if (!isYoutubeHost(hostname)) {
    return null;
  }

  if (url.pathname === "/watch") {
    const videoId = url.searchParams.get("v") ?? url.searchParams.get("vi");
    return videoId && videoIdPattern.test(videoId) ? videoId : null;
  }

  return getPathVideoId(url, ["v", "vi", "shorts", "embed"]);
};

export const getYoutubeVideoId = (message: string) => {
  const urls = message.match(urlPattern) ?? [];

  for (const rawUrl of urls) {
    try {
      const videoId = getVideoIdFromUrl(new URL(trimTrailingPunctuation(rawUrl)));
      if (videoId) {
        return videoId;
      }
    } catch {
      continue;
    }
  }

  return null;
};

export const getYoutubeVideoUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;

export const isS3Configured = () => isS3ConfiguredConfig();

export const getFilePath = (videoId: string, format: "mp3" | "mp4") => {
  if (!safeFileVideoIdPattern.test(videoId)) {
    throw new Error(`Invalid video ID for file path: ${videoId}`);
  }

  return `${getFilesDir()}/${videoId}.${format}`;
};

export const formatSeconds = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
};

export const getVideoInfo = async (videoId: string): Promise<Payload> => {
  const info = await youtubedl(getYoutubeVideoUrl(videoId), {
    dumpSingleJson: true,
    noCheckCertificates: true,
    noWarnings: true,
    preferFreeFormats: true,
    ...getYoutubeDlAuthOptions(),
    addHeader: ["referer:youtube.com", "user-agent:googlebot"],
  });

  if (typeof info === "string") {
    throw new Error("Failed to fetch video info");
  }

  return info as Payload;
};
