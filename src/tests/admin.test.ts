import { AdminVideoNotFoundError, createAdminService } from "../admin.ts";
import type { AdminRepository } from "../admin.ts";
import type { StoredVideo } from "../db.ts";
import type { Storage } from "../storage.ts";
import type { Video } from "../types.ts";
import { describe, expect, it } from "bun:test";

const createStoredVideo = (overrides: Partial<StoredVideo> = {}): StoredVideo => ({
  video_id: "adminVideo01",
  video_name: "Admin Video",
  video_description: null,
  video_url: "https://www.youtube.com/watch?v=adminVideo01",
  video_added_date: "2026-01-01T00:00:00.000Z",
  video_path: "/tmp/adminVideo01.mp3",
  video_artwork_path: "/tmp/adminVideo01.jpg",
  video_chapters_path: "/tmp/adminVideo01.json",
  video_length: 120,
  publication_status: "published",
  is_deleted: false,
  ...overrides,
});

const createRepository = (initialVideos: StoredVideo[]) => {
  const videos = new Map(initialVideos.map((video) => [video.video_id, { ...video }]));
  const repository: AdminRepository = {
    list() {
      return [...videos.values()].filter((video) => !video.is_deleted);
    },
    findById(videoId) {
      return videos.get(videoId) ?? null;
    },
    markDeleted(videoId) {
      const video = videos.get(videoId);
      if (video) video.is_deleted = true;
    },
    markActive(videoId) {
      const video = videos.get(videoId);
      if (video) video.is_deleted = false;
    },
  };
  return { repository, videos };
};

const createStorage = (deleteEpisodeAssets: Storage["deleteEpisodeAssets"] = async () => {}): Storage => ({
  kind: "local",
  async uploadAudio(): Promise<void> {},
  async uploadArtwork(): Promise<void> {},
  async uploadChapters(): Promise<void> {},
  async uploadRss(): Promise<void> {},
  async ensureCoverImage(): Promise<void> {},
  async getAudioMetadata(): Promise<{ exists: boolean }> {
    return { exists: true };
  },
  async getArtworkMetadata(): Promise<{ exists: boolean }> {
    return { exists: true };
  },
  async getChaptersMetadata(): Promise<{ exists: boolean }> {
    return { exists: true };
  },
  deleteEpisodeAssets,
});

const immediateQueue = <T>(task: () => Promise<T>) => task();

describe("admin service", () => {
  it("should list active RSS videos newest first", () => {
    const older = createStoredVideo({ video_id: "olderVideo01", video_added_date: "2026-01-01" });
    const newer = createStoredVideo({ video_id: "newerVideo01", video_added_date: "2026-02-01" });
    const deleted = createStoredVideo({ video_id: "deletedVid01", is_deleted: true });
    const { repository } = createRepository([older, newer, deleted]);
    const service = createAdminService({ repository, storage: createStorage(), enqueue: immediateQueue });

    expect(service.listVideos().map((video) => video.video_id)).toEqual(["newerVideo01", "olderVideo01"]);
  });

  it("should mark a video deleted, rebuild RSS, and remove its audio", async () => {
    const video = createStoredVideo();
    const { repository, videos } = createRepository([video]);
    const feedSnapshots: string[][] = [];
    const deletedAssets: Array<[string, string, string | null | undefined, string | null | undefined]> = [];
    const service = createAdminService({
      repository,
      storage: createStorage(async (videoId, audioPath, artworkPath, chaptersPath) => {
        deletedAssets.push([videoId, audioPath, artworkPath, chaptersPath]);
      }),
      async feedGenerator(feedVideos: Video[]): Promise<void> {
        feedSnapshots.push(feedVideos.map((item) => item.video_id));
      },
      enqueue: immediateQueue,
    });

    await expect(service.deleteVideo(video.video_id)).resolves.toMatchObject({ is_deleted: true });

    expect(videos.get(video.video_id)?.is_deleted).toBe(true);
    expect(feedSnapshots).toEqual([[]]);
    expect(deletedAssets).toEqual([
      [video.video_id, video.video_path, video.video_artwork_path, video.video_chapters_path],
    ]);
  });

  it("should restore the database flag and RSS when feed publication fails", async () => {
    const video = createStoredVideo();
    const { repository, videos } = createRepository([video]);
    const feedSnapshots: string[][] = [];
    let deleteAssetsCalls = 0;
    const service = createAdminService({
      repository,
      storage: createStorage(async () => {
        deleteAssetsCalls += 1;
      }),
      async feedGenerator(feedVideos): Promise<void> {
        feedSnapshots.push(feedVideos.map((item) => item.video_id));
        if (feedSnapshots.length === 1) throw new Error("RSS upload failed");
      },
      enqueue: immediateQueue,
      log: { error(): void {} },
    });

    await expect(service.deleteVideo(video.video_id)).rejects.toThrow("RSS upload failed");

    expect(videos.get(video.video_id)?.is_deleted).toBe(false);
    expect(feedSnapshots).toEqual([[], [video.video_id]]);
    expect(deleteAssetsCalls).toBe(0);
  });

  it("should reject unknown video IDs", async () => {
    const { repository } = createRepository([]);
    const service = createAdminService({ repository, storage: createStorage(), enqueue: immediateQueue });

    await expect(service.deleteVideo("missingVideo")).rejects.toBeInstanceOf(AdminVideoNotFoundError);
  });
});
