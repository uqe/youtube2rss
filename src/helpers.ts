import youtubedl, { type Payload } from "youtube-dl-exec";

export const getYoutubeVideoId = (message: string) => {
  const regex =
    /^https?:\/\/(?:(?:youtu\.be\/)|(?:(?:www\.)?youtube\.com\/(?:(?:watch\?(?:[^&]+&)?vi?=)|(?:vi?\/)|(?:shorts\/))))([a-zA-Z0-9_-]{11,})/gim;

  const res = regex.exec(message);
  return res && res[1];
};

export const isS3Configured = () => {
  return Boolean(Bun.env.S3_ENDPOINT && Bun.env.S3_BUCKET && Bun.env.S3_ACCESS_KEY && Bun.env.S3_SECRET_KEY);
};

export const getFilePath = (videoId: string, format: "mp3" | "mp4") =>
  Bun.env.IS_TEST ? `./src/tests/data/${videoId}.${format}` : `./public/files/${videoId}.${format}`;

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
