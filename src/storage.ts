import { isS3Configured } from "./config.ts";
import { createS3Storage } from "./s3.ts";

export interface Storage {
  kind: "local" | "remote";
  uploadAudio(videoId: string, filePath: string): Promise<void>;
  uploadArtwork(videoId: string, filePath: string): Promise<void>;
  uploadChapters(videoId: string, filePath: string): Promise<void>;
  uploadRss(filePath: string): Promise<void>;
  ensureCoverImage(): Promise<void>;
  getAudioMetadata(videoId: string, filePath: string): Promise<AudioMetadata>;
  getArtworkMetadata(videoId: string, filePath: string): Promise<ArtworkMetadata>;
  getChaptersMetadata(videoId: string, filePath: string): Promise<ChaptersMetadata>;
  deleteEpisodeAssets(
    videoId: string,
    audioPath: string,
    artworkPath?: string | null,
    chaptersPath?: string | null
  ): Promise<void>;
}

export interface AudioMetadata {
  exists: boolean;
  size?: number;
  filePath?: string;
}

export interface ArtworkMetadata {
  exists: boolean;
}

export interface ChaptersMetadata {
  exists: boolean;
}

const deleteLocalFile = async (filePath?: string | null) => {
  if (!filePath) return;

  const file = Bun.file(filePath);
  if (await file.exists()) {
    await file.delete();
  }
};

export interface StorageFactoryOptions {
  isRemoteConfigured?: () => boolean;
  createRemoteStorage?: () => Storage;
}

export const createLocalStorage = (): Storage => ({
  kind: "local",
  async uploadAudio(): Promise<void> {},
  async uploadArtwork(): Promise<void> {},
  async uploadChapters(): Promise<void> {},
  async uploadRss(): Promise<void> {},
  async ensureCoverImage(): Promise<void> {},
  async getAudioMetadata(_videoId, filePath): Promise<AudioMetadata> {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return { exists: false };
    }

    return { exists: true, size: file.size, filePath };
  },
  async getArtworkMetadata(_videoId, filePath): Promise<ArtworkMetadata> {
    return { exists: await Bun.file(filePath).exists() };
  },
  async getChaptersMetadata(_videoId, filePath): Promise<ChaptersMetadata> {
    return { exists: await Bun.file(filePath).exists() };
  },
  async deleteEpisodeAssets(_videoId, audioPath, artworkPath, chaptersPath): Promise<void> {
    await Promise.all([deleteLocalFile(audioPath), deleteLocalFile(artworkPath), deleteLocalFile(chaptersPath)]);
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
