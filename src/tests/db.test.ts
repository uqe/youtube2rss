import { Database } from "bun:sqlite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { addVideoToDb, createDb, dbName, getAllVideos, isVideoExists } from "../db.ts";

const testDbFile = "youtube2rss.test.db";

describe("db tests", () => {
  beforeAll(async () => {
    await createDb();
  });

  afterEach(() => {
    // Clear the database after each test
    const db = new Database(testDbFile, { readwrite: true });
    db.run("DELETE FROM videos");
    db.close();
  });

  afterAll(async () => {
    await Bun.file(testDbFile).delete();
  });

  describe("addVideoToDb", () => {
    it("should add a video to the database", async () => {
      const videoId = "fKP4uioezqk";
      const videoName = "Test Video";
      const videoDescription = "This is a test video";
      const videoUrl = "https://www.youtube.com/watch?v=fKP4uioezqk";
      const videoAddeddate = "2022-01-01";
      const videoPath = "/path/to/test.mp4";
      const videoLength = 228;

      await addVideoToDb(videoId, videoName, videoDescription, videoUrl, videoAddeddate, videoPath, videoLength);
      const videos = getAllVideos();

      expect(videos.length).toBe(1);
      expect(videos[0]).toMatchObject({
        video_id: videoId,
        video_name: videoName,
        video_description: videoDescription,
        video_url: videoUrl,
        video_added_date: videoAddeddate,
        video_path: videoPath,
        video_length: videoLength,
      });
    });

    it("should allow adding multiple videos", async () => {
      const videoIds = ["vid1", "vid2", "vid3"];
      for (const id of videoIds) {
        await addVideoToDb(
          id,
          `Title ${id}`,
          `Description ${id}`,
          `https://example.com/watch?v=${id}`,
          "2022-12-12",
          `/path/to/${id}.mp4`,
          300
        );
      }
      const videos = getAllVideos();
      expect(videos.length).toBe(3);
      videoIds.forEach((id, index) => {
        expect(videos[index].video_id).toBe(id);
      });
    });

    it("should handle null description", async () => {
      const videoId = "nullDesc";
      await addVideoToDb(
        videoId,
        "Test Video",
        null,
        "https://example.com/test.mp4",
        "2022-01-01",
        "/path/to/test.mp4",
        456
      );
      const videos = getAllVideos();
      expect(videos.length).toBe(1);
      expect(videos[0].video_description).toBeNull();
    });
  });

  describe("getAllVideos", () => {
    it("should return empty array when no videos exist", () => {
      const videos = getAllVideos();
      expect(videos).toEqual([]);
    });

    it("should return all videos in the database", async () => {
      const video1 = {
        video_id: "uBvlflKbn7A",
        video_name: "Test Video 1",
        video_description: "This is a test video 1",
        video_url: "https://www.youtube.com/watch?v=uBvlflKbn7A",
        video_added_date: "2022-01-01",
        video_path: "/path/to/test1.mp4",
        video_length: 1113,
      };

      const video2 = {
        video_id: "45",
        video_name: "Test Video 2",
        video_description: "This is a test video 2",
        video_url: "https://example.com/test2.mp4",
        video_added_date: "2022-01-02",
        video_path: "/path/to/test2.mp4",
        video_length: 456,
      };

      await addVideoToDb(
        video1.video_id,
        video1.video_name,
        video1.video_description,
        video1.video_url,
        video1.video_added_date,
        video1.video_path,
        video1.video_length
      );

      await addVideoToDb(
        video2.video_id,
        video2.video_name,
        video2.video_description,
        video2.video_url,
        video2.video_added_date,
        video2.video_path,
        video2.video_length
      );

      const videos = getAllVideos();
      expect(videos.length).toBe(2);
      expect(videos[0]).toMatchObject(video1);
      expect(videos[1]).toMatchObject(video2);
    });
  });

  describe("isVideoExists", () => {
    const videoId = "ghTYrL8BiSY";

    it("should return true if the video exists in the database", async () => {
      await addVideoToDb(
        videoId,
        "Test Video",
        null,
        "https://example.com/test.mp4",
        "2022-01-01",
        "/path/to/test.mp4",
        456
      );

      const exists = isVideoExists(videoId);
      expect(exists).toBe(true);
    });

    it("should return false if the video does not exist in the database", () => {
      const exists = isVideoExists(videoId);
      expect(exists).toBe(false);
    });
  });

  describe("createDb", () => {
    it("createDb should create a database file if it does not exist", async () => {
      try {
        await Bun.file(dbName()).delete();
      } catch (_) {
        // ignore if file doesn't exist
      }
      await createDb();
      const dbFile = Bun.file(dbName());
      const dbFileExists = await dbFile.exists();
      expect(dbFileExists).toBe(true);
    });

    it("createDb should not overwrite an existing database", async () => {
      await addVideoToDb(
        "dupTest",
        "Duplicate Test",
        "Testing duplicate creation",
        "https://example.com/dup",
        "2022-03-03",
        "/path/to/dup.mp4",
        123
      );
      await createDb();
      const videos = getAllVideos();
      expect(videos.length).toBe(1);
      expect(videos[0].video_id).toBe("dupTest");
    });
  });

  describe("dbName", () => {
    it("dbName returns correct file name for test environment", () => {
      const expected = "youtube2rss.test.db";
      const actual = dbName();
      expect(actual).toBe(expected);
    });
  });
});
