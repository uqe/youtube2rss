import { Database } from "bun:sqlite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";

import {
  addVideoToDb,
  createDatabaseFactory,
  createDb,
  createVideoRepository,
  dbName,
  getAllVideos,
  isVideoExists,
  latestDatabaseVersion,
  videoRepository,
} from "../db.ts";
import type { Video } from "../types.ts";

const testDbFile = "youtube2rss.test.db";
const customDbFile = "./src/tests/data/youtube2rss.custom.test.db";
const silentLogger = {
  info(): void {},
  success(): void {},
};

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
        video_artwork_path: null,
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
          300,
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
        456,
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
        100,
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
        100,
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
        100,
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
        video1.video_length,
      );

      await addVideoToDb(
        video2.video_id,
        video2.video_name,
        video2.video_description,
        video2.video_url,
        video2.video_added_date,
        video2.video_path,
        video2.video_length,
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
        456,
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
        100,
      );

      expect(isVideoExists("TestId")).toBe(true);
      expect(isVideoExists("testid")).toBe(false);
      expect(isVideoExists("TESTID")).toBe(false);
    });

    it("should treat SQL-like video IDs as plain values", async () => {
      const videoId = "' OR 1=1 --";

      await addVideoToDb(
        videoId,
        "SQL-like ID",
        null,
        "https://example.com/sql-like",
        "2022-01-01",
        "/path/to/sql-like.mp4",
        100,
      );

      expect(isVideoExists(videoId)).toBe(true);
      expect(isVideoExists("' OR 1=1")).toBe(false);
    });

    it("should reactivate a soft-deleted video when it is downloaded again", async () => {
      const videoId = "deletedVideo";
      await addVideoToDb(videoId, "Old episode", null, "https://example.com/old", "2022-01-01", "/old.mp3", 100);
      videoRepository.markDeleted(videoId);

      expect(isVideoExists(videoId)).toBe(false);
      expect(videoRepository.getPublicationStatus(videoId)).toBeNull();

      videoRepository.create(
        {
          video_id: videoId,
          video_name: "New episode",
          video_description: null,
          video_url: "https://example.com/new",
          video_added_date: "2022-02-01",
          video_path: "/new.mp3",
          video_artwork_path: "/new.jpg",
          video_length: 200,
        },
        "pending",
      );

      expect(videoRepository.findById(videoId)).toMatchObject({
        video_name: "New episode",
        video_path: "/new.mp3",
        video_artwork_path: "/new.jpg",
        publication_status: "pending",
        is_deleted: false,
      });
      expect(videoRepository.list().map((video) => video.video_id)).toEqual([videoId]);
    });
  });

  describe("createDb", () => {
    it("createDb should create a database file if it does not exist", async () => {
      try {
        await Bun.file(dbName()).delete();
      } catch {
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
        123,
      );
      await createDb();
      const videos = getAllVideos();
      expect(videos.length).toBe(1);
      expect(videos[0].video_id).toBe("dupTest");
    });

    it("should migrate a legacy database and preserve its videos", async () => {
      await Bun.file(customDbFile)
        .delete()
        .catch(() => {});
      const legacyDb = new Database(customDbFile, { create: true });
      legacyDb.run(`
        CREATE TABLE videos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          video_id TEXT,
          video_name TEXT,
          video_description TEXT,
          video_url TEXT,
          video_added_date TEXT,
          video_path TEXT,
          video_length INTEGER
        )
      `);
      legacyDb.run(
        "INSERT INTO videos (video_id, video_name, video_description, video_url, video_added_date, video_path, video_length) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["legacyVideo", "Legacy", null, "https://example.com/legacy", "2022-01-01", "/legacy.mp3", 100],
      );
      legacyDb.close();

      const dbFactory = createDatabaseFactory(() => customDbFile);
      await createDb({ dbFactory, isTestEnvironment: () => true, log: silentLogger });

      const migratedDb = new Database(customDbFile, { readonly: true });
      const version = migratedDb.query("PRAGMA user_version").get() as { user_version: number };
      migratedDb.close();
      const repository = createVideoRepository({ dbFactory });

      expect(version.user_version).toBe(latestDatabaseVersion);
      expect(repository.list().map((video) => video.video_id)).toEqual(["legacyVideo"]);
      expect(repository.getPublicationStatus("legacyVideo")).toBe("published");
      expect(repository.findById("legacyVideo")?.is_deleted).toBe(false);
      expect(repository.findById("legacyVideo")?.video_artwork_path).toBeNull();
      expect(repository.findById("legacyVideo")?.video_chapters_path).toBeNull();
    });

    it("should reject a legacy database with duplicate video IDs", async () => {
      const duplicateDbFile = "./src/tests/data/youtube2rss.duplicate.test.db";
      await Bun.file(duplicateDbFile)
        .delete()
        .catch(() => {});
      const legacyDb = new Database(duplicateDbFile, { create: true });
      legacyDb.run("CREATE TABLE videos (id INTEGER PRIMARY KEY AUTOINCREMENT, video_id TEXT NOT NULL)");
      legacyDb.run("INSERT INTO videos (video_id) VALUES (?), (?)", ["duplicate", "duplicate"]);
      legacyDb.close();

      try {
        await expect(
          createDb({
            dbFactory: createDatabaseFactory(() => duplicateDbFile),
            isTestEnvironment: () => true,
            log: silentLogger,
          }),
        ).rejects.toThrow("Cannot add unique video_id index: duplicate value duplicate");
      } finally {
        await Bun.file(duplicateDbFile).delete();
      }
    });

    it("should reject a database created by a newer application version", async () => {
      const futureDbFile = "./src/tests/data/youtube2rss.future.test.db";
      await Bun.file(futureDbFile)
        .delete()
        .catch(() => {});
      const futureDb = new Database(futureDbFile, { create: true });
      futureDb.run(`PRAGMA user_version = ${latestDatabaseVersion + 1}`);
      futureDb.close();

      try {
        await expect(
          createDb({
            dbFactory: createDatabaseFactory(() => futureDbFile),
            isTestEnvironment: () => true,
            log: silentLogger,
          }),
        ).rejects.toThrow(`Database version ${latestDatabaseVersion + 1} is newer than supported version`);
      } finally {
        await Bun.file(futureDbFile).delete();
      }
    });

    it("should distinguish database creation from an up-to-date database", async () => {
      const loggedDbFile = "./src/tests/data/youtube2rss.logged.test.db";
      const infoMessages: string[] = [];
      const successMessages: string[] = [];
      const options = {
        dbFactory: createDatabaseFactory(() => loggedDbFile),
        isTestEnvironment: () => false,
        log: {
          info: (message: string) => infoMessages.push(message),
          success: (message: string) => successMessages.push(message),
        },
      };
      await Bun.file(loggedDbFile)
        .delete()
        .catch(() => {});

      try {
        await createDb(options);
        await createDb(options);

        expect(successMessages).toEqual(["Database created!"]);
        expect(infoMessages).toEqual(["Database is up to date"]);
      } finally {
        await Bun.file(loggedDbFile).delete();
      }
    });
  });

  describe("dbName", () => {
    it("dbName returns correct file name for test environment", () => {
      const expected = "youtube2rss.test.db";
      const actual = dbName();
      expect(actual).toBe(expected);
    });
  });

  describe("createDatabaseFactory", () => {
    afterEach(async () => {
      await Bun.file(customDbFile)
        .delete()
        .catch(() => {});
    });

    it("should create repositories isolated by database factory", async () => {
      await Bun.file(customDbFile)
        .delete()
        .catch(() => {});

      const dbFactory = createDatabaseFactory(() => customDbFile);
      await createDb({
        dbFactory,
        isTestEnvironment: () => true,
        log: silentLogger,
      });

      const customRepository = createVideoRepository({ dbFactory });
      const defaultRepository = createVideoRepository();
      const video: Video = {
        video_id: "customDbVideo",
        video_name: "Custom DB Video",
        video_description: null,
        video_url: "https://example.com/custom",
        video_added_date: "2026-01-01",
        video_path: "/path/custom.mp4",
        video_artwork_path: null,
        video_chapters_path: null,
        video_length: 321,
      };

      customRepository.create(video);

      expect(customRepository.exists("customDbVideo")).toBe(true);
      expect(customRepository.list()).toEqual([video]);
      expect(defaultRepository.exists("customDbVideo")).toBe(false);
    });
  });

  describe("videoRepository", () => {
    it("should be a singleton instance", () => {
      expect(videoRepository).toBeDefined();
      expect(typeof videoRepository.create).toBe("function");
      expect(typeof videoRepository.list).toBe("function");
      expect(typeof videoRepository.exists).toBe("function");
      expect(typeof videoRepository.getPublicationStatus).toBe("function");
      expect(typeof videoRepository.markPublished).toBe("function");
      expect(typeof videoRepository.findById).toBe("function");
      expect(typeof videoRepository.markDeleted).toBe("function");
      expect(typeof videoRepository.markActive).toBe("function");
    });

    it("create should add video using Video object", () => {
      const video: Video = {
        video_id: "repoTest1",
        video_name: "Repository Test",
        video_description: "Testing repository pattern",
        video_url: "https://example.com/repo",
        video_added_date: "2022-05-05",
        video_path: "/path/to/repo.mp4",
        video_artwork_path: "/path/to/repo.jpg",
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

    it("should track publication status", () => {
      const video: Video = {
        video_id: "pendingVideo",
        video_name: "Pending Video",
        video_description: null,
        video_url: "https://example.com/pending",
        video_added_date: "2026-01-01",
        video_path: "/path/pending.mp3",
        video_length: 100,
      };

      videoRepository.create(video, "pending");
      expect(videoRepository.getPublicationStatus(video.video_id)).toBe("pending");

      videoRepository.markPublished(video.video_id);
      expect(videoRepository.getPublicationStatus(video.video_id)).toBe("published");
    });

    it("should reject duplicate video IDs", () => {
      const video: Video = {
        video_id: "uniqueVideo",
        video_name: "Unique Video",
        video_description: null,
        video_url: "https://example.com/unique",
        video_added_date: "2026-01-01",
        video_path: "/path/unique.mp3",
        video_length: 100,
      };

      videoRepository.create(video);

      expect(() => videoRepository.create(video)).toThrow();
      expect(videoRepository.list()).toHaveLength(1);
    });

    it("should soft-delete videos without removing their database records", () => {
      const video: Video = {
        video_id: "softDeleteVideo",
        video_name: "Soft Delete Video",
        video_description: null,
        video_url: "https://example.com/soft-delete",
        video_added_date: "2026-01-01",
        video_path: "/path/soft-delete.mp3",
        video_artwork_path: null,
        video_chapters_path: null,
        video_length: 100,
      };

      videoRepository.create(video);
      videoRepository.markDeleted(video.video_id);

      expect(videoRepository.list()).toEqual([]);
      expect(videoRepository.exists(video.video_id)).toBe(false);
      expect(videoRepository.findById(video.video_id)).toMatchObject({
        ...video,
        is_deleted: true,
      });

      videoRepository.markActive(video.video_id);
      expect(videoRepository.list()).toEqual([video]);
    });
  });

  describe("createVideoRepository", () => {
    it("should create a new repository instance", () => {
      const repo = createVideoRepository();

      expect(repo).toBeDefined();
      expect(typeof repo.create).toBe("function");
      expect(typeof repo.list).toBe("function");
      expect(typeof repo.exists).toBe("function");
      expect(typeof repo.getPublicationStatus).toBe("function");
      expect(typeof repo.markPublished).toBe("function");
      expect(typeof repo.findById).toBe("function");
      expect(typeof repo.markDeleted).toBe("function");
      expect(typeof repo.markActive).toBe("function");
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

    it("separate repositories should preserve insertion order when listing", () => {
      const repo = createVideoRepository();
      const firstVideo: Video = {
        video_id: "ordered1",
        video_name: "Ordered 1",
        video_description: null,
        video_url: "https://example.com/ordered1",
        video_added_date: "2022-01-01",
        video_path: "/path/ordered1.mp4",
        video_length: 100,
      };
      const secondVideo: Video = {
        video_id: "ordered2",
        video_name: "Ordered 2",
        video_description: null,
        video_url: "https://example.com/ordered2",
        video_added_date: "2022-01-02",
        video_path: "/path/ordered2.mp4",
        video_length: 200,
      };

      repo.create(firstVideo);
      repo.create(secondVideo);

      expect(repo.list().map((video) => video.video_id)).toEqual(["ordered1", "ordered2"]);
    });
  });
});
