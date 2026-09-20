import { describe, expect, it, mock } from "bun:test";

import { AdminVideoNotFoundError, createAdminService } from "../admin.ts";
import type { AdminRepository } from "../admin.ts";
import type { StoredVideo } from "../db.ts";
import type { Storage } from "../storage.ts";
import type { Video } from "../types.ts";

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
      if (video) {
        video.is_deleted = true;
      }
    },
    markActive(videoId) {
      const video = videos.get(videoId);
      if (video) {
        video.is_deleted = false;
      }
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
    const service = createAdminService({
      repository,
      storage: createStorage(),
      enqueue: immediateQueue,
    });

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
        if (feedSnapshots.length === 1) {
          throw new Error("RSS upload failed");
        }
      },
      enqueue: immediateQueue,
      log: { error(): void {} },
    });

    await expect(service.deleteVideo(video.video_id)).rejects.toThrow("RSS upload failed");

    expect(videos.get(video.video_id)?.is_deleted).toBe(false);
    expect(feedSnapshots).toEqual([[], [video.video_id]]);
    expect(deleteAssetsCalls).toBe(0);
  });

  it("should preserve the original RSS error when restoring the feed also fails", async () => {
    const video = createStoredVideo();
    const { repository, videos } = createRepository([video]);
    const failure = new Error("RSS upload failed");
    const feedGenerator = mock(async () => {});
    feedGenerator.mockRejectedValueOnce(failure).mockRejectedValueOnce(new Error("Rollback failed"));
    const deleteAssets = mock(async () => {});
    const error = mock((_message: string) => {});
    const service = createAdminService({
      repository,
      storage: createStorage(deleteAssets),
      feedGenerator,
      enqueue: immediateQueue,
      log: { error },
    });

    await expect(service.deleteVideo(video.video_id)).rejects.toBe(failure);

    expect(videos.get(video.video_id)?.is_deleted).toBe(false);
    expect(feedGenerator).toHaveBeenCalledTimes(2);
    expect(deleteAssets).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      `Failed to restore RSS after deleting ${video.video_id}: Error: Rollback failed`,
    );
  });

  it("should keep an episode hidden and retry asset cleanup after a storage failure", async () => {
    const video = createStoredVideo();
    const { repository, videos } = createRepository([video]);
    const events: string[] = [];
    let cleanupCalls = 0;
    const service = createAdminService({
      repository,
      storage: createStorage(async () => {
        events.push("cleanup");
        cleanupCalls += 1;
        if (cleanupCalls === 1) {
          throw new Error("Storage unavailable");
        }
      }),
      async feedGenerator(feedVideos) {
        expect(feedVideos).toEqual([]);
        events.push("feed");
      },
      enqueue: immediateQueue,
    });

    await expect(service.deleteVideo(video.video_id)).rejects.toThrow("Storage unavailable");
    expect(videos.get(video.video_id)?.is_deleted).toBe(true);
    expect(service.listVideos()).toEqual([]);

    await expect(service.deleteVideo(video.video_id)).resolves.toMatchObject({ is_deleted: true });
    expect(events).toEqual(["feed", "cleanup", "feed", "cleanup"]);
    expect(videos.get(video.video_id)?.is_deleted).toBe(true);
  });

  it("should not reactivate a previously deleted episode when the feed fails on retry", async () => {
    const video = createStoredVideo({ is_deleted: true });
    const { repository, videos } = createRepository([video]);
    const deleteAssets = mock(async () => {});
    const feedGenerator = mock(async () => {
      throw new Error("RSS unavailable");
    });
    const service = createAdminService({
      repository,
      storage: createStorage(deleteAssets),
      feedGenerator,
      enqueue: immediateQueue,
    });

    await expect(service.deleteVideo(video.video_id)).rejects.toThrow("RSS unavailable");

    expect(videos.get(video.video_id)?.is_deleted).toBe(true);
    expect(feedGenerator).toHaveBeenCalledTimes(1);
    expect(deleteAssets).not.toHaveBeenCalled();
  });

  it("should reject unknown video IDs", async () => {
    const { repository } = createRepository([]);
    const service = createAdminService({
      repository,
      storage: createStorage(),
      enqueue: immediateQueue,
    });

    await expect(service.deleteVideo("missingVideo")).rejects.toBeInstanceOf(AdminVideoNotFoundError);
  });
});
