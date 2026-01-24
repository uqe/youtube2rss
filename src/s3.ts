import { S3Client } from "bun";
import { getS3Config } from "./config.ts";
import { logger } from "./logger.ts";
import type { Storage } from "./storage.ts";

const s3Config = getS3Config();

const s3client = new S3Client({
  endpoint: s3Config.endpoint || "undefined.com",
  bucket: s3Config.bucket,
  accessKeyId: s3Config.accessKey,
  secretAccessKey: s3Config.secretKey,
});

const uploadAudio = async (videoId: string, filePath: string): Promise<void> => {
  try {
    await s3client.write(`files/${videoId}.mp3`, Bun.file(filePath));
  } catch (error) {
    logger.error(`Error putting file on S3: ${error}`);
  }
};

const uploadRss = async (filePath: string): Promise<void> => {
  try {
    await s3client.write("rss.xml", Bun.file(filePath));
  } catch (error) {
    logger.error(`Error uploading XML to S3: ${error}`);
  }
};

const ensureCoverImage = async (): Promise<void> => {
  try {
    const isCoverExists = await s3client.exists("cover.jpg");

    if (!isCoverExists) {
      await s3client.write("cover.jpg", Bun.file("./public/cover.jpg"));
    }
  } catch (error) {
    logger.error(`Error checking cover image on S3: ${error}`);
  }
};

export const createS3Storage = (): Storage => ({
  uploadAudio,
  uploadRss,
  ensureCoverImage,
});
