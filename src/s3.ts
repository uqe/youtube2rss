import { S3Client } from "bun";
import { getS3Config, isS3Configured } from "./config.ts";
import { logger } from "./logger.ts";
import type { Storage } from "./storage.ts";

const s3Config = getS3Config();

if (!isS3Configured()) {
  throw new Error(
    "S3 is not properly configured. Please set all required environment variables: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY"
  );
}

const s3client = new S3Client({
  endpoint: s3Config.endpoint,
  bucket: s3Config.bucket,
  accessKeyId: s3Config.accessKey,
  secretAccessKey: s3Config.secretKey,
});

const uploadAudio = async (videoId: string, filePath: string): Promise<void> => {
  try {
    await s3client.write(`files/${videoId}.mp3`, Bun.file(filePath));
  } catch (error) {
    logger.error(`Error putting file on S3 for video ${videoId}: ${error}`);
    throw error;
  }
};

const uploadRss = async (filePath: string): Promise<void> => {
  try {
    await s3client.write("rss.xml", Bun.file(filePath));
  } catch (error) {
    logger.error(`Error uploading RSS XML to S3 from ${filePath}: ${error}`);
    throw error;
  }
};

const ensureCoverImage = async (): Promise<void> => {
  try {
    const isCoverExists = await s3client.exists("cover.jpg");

    if (!isCoverExists) {
      await s3client.write("cover.jpg", Bun.file("./public/cover.jpg"));
    }
  } catch (error) {
    logger.error(`Error ensuring cover image on S3: ${error}`);
    throw error;
  }
};

export const createS3Storage = (): Storage => ({
  uploadAudio,
  uploadRss,
  ensureCoverImage,
});
