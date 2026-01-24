import { isS3Configured } from "./config.ts";
import { createS3Storage } from "./s3.ts";

export interface Storage {
  uploadAudio(videoId: string, filePath: string): Promise<void>;
  uploadRss(filePath: string): Promise<void>;
  ensureCoverImage(): Promise<void>;
}

const createLocalStorage = (): Storage => ({
  async uploadAudio(): Promise<void> {},
  async uploadRss(): Promise<void> {},
  async ensureCoverImage(): Promise<void> {},
});

let storageInstance: Storage | null = null;

export const getStorage = (): Storage => {
  if (!storageInstance) {
    storageInstance = isS3Configured() ? createS3Storage() : createLocalStorage();
  }

  if (!storageInstance) {
    throw new Error("Storage is not initialized");
  }

  return storageInstance;
};
