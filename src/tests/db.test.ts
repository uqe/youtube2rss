import {
  addVideoToDb,
  createDb,
  createVideoRepository,
  dbName,
  getAllVideos,
  isVideoExists,
  videoRepository,
} from "../db.ts";
import type { Video } from "../types.ts";
import { Database } from "bun:sqlite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";

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

    it("should handle special characters in video name and description", async () => {
      const videoId = "specialChars";
      const specialName = 'Test "Video" with <special> & chars';
      const specialDesc = "Description with 'quotes' and émojis 🎉";

      await addVideoToDb(
        videoId,
        specialName,
        specialDesc,
        "https://example.com/test.mp4",
        "2022-01-01",
        "/path/to/test.mp4",
        100
      );

      const videos = getAllVideos();
      expect(videos[0].video_name).toBe(specialName);
      expect(videos[0].video_description).toBe(specialDesc);
    });

    it("should handle very long description", async () => {
      const videoId = "longDesc";
      const longDescription = "A".repeat(10000);

      await addVideoToDb(
        videoId,
        "Test Video",
        longDescription,
        "https://example.com/test.mp4",
        "2022-01-01",
        "/path/to/test.mp4",
        100
      );

      const videos = getAllVideos();
      expect(videos[0].video_description).toBe(longDescription);
      expect(videos[0].video_description?.length).toBe(10000);
    });

    it("should handle empty strings", async () => {
      const videoId = "emptyStrings";

      await addVideoToDb(videoId, "", "", "https://example.com/test.mp4", "2022-01-01", "", 0);

      const videos = getAllVideos();
      expect(videos[0].video_name).toBe("");
      expect(videos[0].video_description).toBe("");
      expect(videos[0].video_path).toBe("");
      expect(videos[0].video_length).toBe(0);
    });

    it("should handle Unicode characters in all fields", async () => {
      const videoId = "unicodeTest";
      const unicodeName = "日本語タイトル";
      const unicodeDesc = "Описание на русском языке 中文描述";

      await addVideoToDb(
        videoId,
        unicodeName,
        unicodeDesc,
        "https://example.com/日本語.mp4",
        "2022-01-01",
        "/path/to/日本語.mp4",
        100
      );

      const videos = getAllVideos();
      expect(videos[0].video_name).toBe(unicodeName);
      expect(videos[0].video_description).toBe(unicodeDesc);
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

    it("should return false for empty string videoId", () => {
      const exists = isVideoExists("");
      expect(exists).toBe(false);
    });

    it("should handle case-sensitive video IDs", async () => {
      await addVideoToDb(
        "TestId",
        "Test Video",
        null,
        "https://example.com/test.mp4",
        "2022-01-01",
        "/path/to/test.mp4",
        100
      );

      expect(isVideoExists("TestId")).toBe(true);
      expect(isVideoExists("testid")).toBe(false);
      expect(isVideoExists("TESTID")).toBe(false);
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

  describe("videoRepository", () => {
    it("should be a singleton instance", () => {
      expect(videoRepository).toBeDefined();
      expect(typeof videoRepository.create).toBe("function");
      expect(typeof videoRepository.list).toBe("function");
      expect(typeof videoRepository.exists).toBe("function");
    });

    it("create should add video using Video object", () => {
      const video: Video = {
        video_id: "repoTest1",
        video_name: "Repository Test",
        video_description: "Testing repository pattern",
        video_url: "https://example.com/repo",
        video_added_date: "2022-05-05",
        video_path: "/path/to/repo.mp4",
        video_length: 500,
      };

      videoRepository.create(video);

      const videos = videoRepository.list();
      expect(videos.length).toBe(1);
      expect(videos[0]).toMatchObject(video);
    });

    it("list should return all videos", async () => {
      const video1: Video = {
        video_id: "list1",
        video_name: "List Test 1",
        video_description: "First video",
        video_url: "https://example.com/1",
        video_added_date: "2022-01-01",
        video_path: "/path/1.mp4",
        video_length: 100,
      };

      const video2: Video = {
        video_id: "list2",
        video_name: "List Test 2",
        video_description: "Second video",
        video_url: "https://example.com/2",
        video_added_date: "2022-01-02",
        video_path: "/path/2.mp4",
        video_length: 200,
      };

      videoRepository.create(video1);
      videoRepository.create(video2);

      const videos = videoRepository.list();
      expect(videos.length).toBe(2);
    });

    it("exists should check video existence correctly", () => {
      const video: Video = {
        video_id: "existsTest",
        video_name: "Exists Test",
        video_description: null,
        video_url: "https://example.com/exists",
        video_added_date: "2022-06-06",
        video_path: "/path/exists.mp4",
        video_length: 300,
      };

      expect(videoRepository.exists("existsTest")).toBe(false);

      videoRepository.create(video);

      expect(videoRepository.exists("existsTest")).toBe(true);
      expect(videoRepository.exists("nonExistent")).toBe(false);
    });
  });

  describe("createVideoRepository", () => {
    it("should create a new repository instance", () => {
      const repo = createVideoRepository();

      expect(repo).toBeDefined();
      expect(typeof repo.create).toBe("function");
      expect(typeof repo.list).toBe("function");
      expect(typeof repo.exists).toBe("function");
    });

    it("new repository should share the same database", () => {
      const video: Video = {
        video_id: "sharedDb",
        video_name: "Shared DB Test",
        video_description: "Testing shared database",
        video_url: "https://example.com/shared",
        video_added_date: "2022-07-07",
        video_path: "/path/shared.mp4",
        video_length: 400,
      };

      const repo1 = createVideoRepository();
      const repo2 = createVideoRepository();

      repo1.create(video);

      // Both repositories should see the same data
      expect(repo2.exists("sharedDb")).toBe(true);
      expect(repo2.list().length).toBe(1);
    });
  });
});
