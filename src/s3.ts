import { getValidatedS3Config } from "./config.ts";
import type { S3Config } from "./config.ts";
import { logger } from "./logger.ts";
import type { Storage } from "./storage.ts";
import { S3Client } from "bun";

interface S3StorageClient {
  write(path: string, file: Blob, options?: { type?: string }): Promise<unknown>;
  exists(path: string): Promise<boolean>;
  size(path: string): Promise<number>;
  delete(path: string): Promise<void>;
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

  const uploadArtwork = async (videoId: string, filePath: string): Promise<void> => {
    try {
      await s3client.write(`covers/${videoId}.jpg`, Bun.file(filePath));
    } catch (error) {
      log.error(`Error uploading artwork to S3 for video ${videoId}: ${error}`);
      throw error;
    }
  };

  const uploadChapters = async (videoId: string, filePath: string): Promise<void> => {
    try {
      await s3client.write(`chapters/${videoId}.json`, Bun.file(filePath), {
        type: "application/json+chapters",
      });
    } catch (error) {
      log.error(`Error uploading chapters to S3 for video ${videoId}: ${error}`);
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

  const getArtworkMetadata = async (videoId: string, filePath: string) => {
    if (await Bun.file(filePath).exists()) {
      return { exists: true };
    }

    return { exists: await s3client.exists(`covers/${videoId}.jpg`) };
  };

  const getChaptersMetadata = async (videoId: string, filePath: string) => {
    if (await Bun.file(filePath).exists()) {
      return { exists: true };
    }

    return { exists: await s3client.exists(`chapters/${videoId}.json`) };
  };

  const deleteEpisodeAssets = async (
    videoId: string,
    audioPath: string,
    artworkPath?: string | null,
    chaptersPath?: string | null
  ): Promise<void> => {
    const deleteLocalFile = async (filePath?: string | null) => {
      if (!filePath) return;

      const localFile = Bun.file(filePath);
      if (await localFile.exists()) {
        await localFile.delete();
      }
    };
    const results = await Promise.allSettled([
      s3client.delete(`files/${videoId}.mp3`),
      s3client.delete(`covers/${videoId}.jpg`),
      s3client.delete(`chapters/${videoId}.json`),
      deleteLocalFile(audioPath),
      deleteLocalFile(artworkPath),
      deleteLocalFile(chaptersPath),
    ]);
    const errors = results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map(({ reason }) => String(reason));

    if (errors.length > 0) {
      const error = new Error(`Failed to delete episode assets for video ${videoId}: ${errors.join("; ")}`);
      log.error(error.message);
      throw error;
    }
  };

  return {
    kind: "remote",
    uploadAudio,
    uploadArtwork,
    uploadChapters,
    uploadRss,
    ensureCoverImage,
    getAudioMetadata,
    getArtworkMetadata,
    getChaptersMetadata,
    deleteEpisodeAssets,
  };
};
