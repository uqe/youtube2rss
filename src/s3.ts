import { getValidatedS3Config } from "./config.ts";
import type { S3Config } from "./config.ts";
import { logger } from "./logger.ts";
import type { Storage } from "./storage.ts";
import { S3Client } from "bun";

interface S3StorageClient {
  write(path: string, file: Blob): Promise<unknown>;
  exists(path: string): Promise<boolean>;
  size(path: string): Promise<number>;
}

interface S3StorageLogger {
  error(message: string): void;
}

interface S3StorageOptions {
  client?: S3StorageClient;
  config?: S3Config | null;
  coverImagePath?: string;
  log?: S3StorageLogger;
}

const createS3Client = (s3Config: S3Config | null) => {
  if (!s3Config) {
    throw new Error("S3 is not configured");
  }

  return new S3Client({
    endpoint: s3Config.endpoint,
    bucket: s3Config.bucket,
    accessKeyId: s3Config.accessKey,
    secretAccessKey: s3Config.secretKey,
  });
};

export const createS3Storage = ({
  client,
  config,
  coverImagePath = "./public/cover.jpg",
  log = logger,
}: S3StorageOptions = {}): Storage => {
  const s3client = client ?? createS3Client(config === undefined ? getValidatedS3Config() : config);

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

  const getAudioMetadata = async (videoId: string, filePath: string) => {
    const localFile = Bun.file(filePath);
    if (await localFile.exists()) {
      return { exists: true, size: localFile.size, filePath };
    }

    const objectPath = `files/${videoId}.mp3`;
    if (!(await s3client.exists(objectPath))) {
      return { exists: false };
    }

    return { exists: true, size: await s3client.size(objectPath) };
  };

  return {
    kind: "remote",
    uploadAudio,
    uploadRss,
    ensureCoverImage,
    getAudioMetadata,
  };
};
