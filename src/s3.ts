import { getS3Config, isS3Configured } from "./config.ts";
import { logger } from "./logger.ts";
import type { Storage } from "./storage.ts";
import { S3Client } from "bun";

interface S3StorageClient {
  write(path: string, file: Blob): Promise<unknown>;
  exists(path: string): Promise<boolean>;
}

interface S3StorageLogger {
  error(message: string): void;
}

interface S3StorageOptions {
  client?: S3StorageClient;
  isConfigured?: () => boolean;
  coverImagePath?: string;
  log?: S3StorageLogger;
}

const createS3Client = () => {
  const s3Config = getS3Config();

  return new S3Client({
    endpoint: s3Config.endpoint,
    bucket: s3Config.bucket,
    accessKeyId: s3Config.accessKey,
    secretAccessKey: s3Config.secretKey,
  });
};

export const createS3Storage = ({
  client,
  isConfigured = isS3Configured,
  coverImagePath = "./public/cover.jpg",
  log = logger,
}: S3StorageOptions = {}): Storage => {
  if (!isConfigured()) {
    throw new Error(
      "S3 is not properly configured. Please set all required environment variables: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY"
    );
  }

  const s3client = client ?? createS3Client();

  const uploadAudio = async (videoId: string, filePath: string): Promise<void> => {
    try {
      await s3client.write(`files/${videoId}.mp3`, Bun.file(filePath));
    } catch (error) {
      log.error(`Error putting file on S3 for video ${videoId}: ${error}`);
      throw error;
    }
  };

  const uploadRss = async (filePath: string): Promise<void> => {
    try {
      await s3client.write("rss.xml", Bun.file(filePath));
    } catch (error) {
      log.error(`Error uploading RSS XML to S3 from ${filePath}: ${error}`);
      throw error;
    }
  };

  const ensureCoverImage = async (): Promise<void> => {
    try {
      const isCoverExists = await s3client.exists("cover.jpg");

      if (!isCoverExists) {
        await s3client.write("cover.jpg", Bun.file(coverImagePath));
      }
    } catch (error) {
      log.error(`Error ensuring cover image on S3: ${error}`);
      throw error;
    }
  };

  return {
    uploadAudio,
    uploadRss,
    ensureCoverImage,
  };
};
