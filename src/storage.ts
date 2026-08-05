import { isS3Configured } from "./config.ts";
import { createS3Storage } from "./s3.ts";

export interface Storage {
  kind: "local" | "remote";
  uploadAudio(videoId: string, filePath: string): Promise<void>;
  uploadRss(filePath: string): Promise<void>;
  ensureCoverImage(): Promise<void>;
  getAudioMetadata(videoId: string, filePath: string): Promise<AudioMetadata>;
}

export interface AudioMetadata {
  exists: boolean;
  size?: number;
  filePath?: string;
}

export interface StorageFactoryOptions {
  isRemoteConfigured?: () => boolean;
  createRemoteStorage?: () => Storage;
}

export const createLocalStorage = (): Storage => ({
  kind: "local",
  async uploadAudio(): Promise<void> {},
  async uploadRss(): Promise<void> {},
  async ensureCoverImage(): Promise<void> {},
  async getAudioMetadata(_videoId, filePath): Promise<AudioMetadata> {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return { exists: false };
    }

    return { exists: true, size: file.size, filePath };
  },
});

export const createStorage = ({
  isRemoteConfigured = isS3Configured,
  createRemoteStorage = createS3Storage,
}: StorageFactoryOptions = {}): Storage => {
  return isRemoteConfigured() ? createRemoteStorage() : createLocalStorage();
};

let storageInstance: Storage | null = null;

export const getStorage = (): Storage => {
  if (!storageInstance) {
    storageInstance = createStorage();
  }

  return storageInstance;
};
