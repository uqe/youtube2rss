import { isS3Configured } from "./config.ts";
import { createS3Storage } from "./s3.ts";

export interface Storage {
  uploadAudio(videoId: string, filePath: string): Promise<void>;
  uploadRss(filePath: string): Promise<void>;
  ensureCoverImage(): Promise<void>;
}

export interface StorageFactoryOptions {
  isRemoteConfigured?: () => boolean;
  createRemoteStorage?: () => Storage;
}

export const createLocalStorage = (): Storage => ({
  async uploadAudio(): Promise<void> {},
  async uploadRss(): Promise<void> {},
  async ensureCoverImage(): Promise<void> {},
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
