import { afterAll, afterEach, assertEquals, assertObjectMatch, beforeAll, DB, describe, it } from "../deps.ts";
import { addVideoToDb, createDb, getAllVideos, isVideoExists } from "../db.ts";

const dbFile = "youtube2rss.test.db";

describe("db tests", () => {
  beforeAll(async () => {
    await createDb();
  });

  afterEach(() => {
    // Clear the database after each test
    // This ensures that each test is independent of the others
    // and doesn't affect the state of the database
    const db = new DB(dbFile, { mode: "write" });
    db.execute("DELETE FROM videos");
    db.close();
  });

  afterAll(() => {
    Deno.remove(dbFile);
  });

  describe("addVideoToDb", () => {
    it("should add a video to the database", async () => {
      const videoId = "fKP4uioezqk";
      const videoName = "Test Video";
      const videoDescription = "This is a test video";
      const videoUrl = "https://www.youtube.com/watch?v=fKP4uioezqk";
      const videoAddeddate = "2022-01-01";
      const videoPath = "/path/to/test.mp4";
      const videoLength = "10:00";

      await addVideoToDb(videoId, videoName, videoDescription, videoUrl, videoAddeddate, videoPath, videoLength);

      const videos = getAllVideos();
      assertEquals(videos.length, 1);
      assertObjectMatch(videos[0], {
        video_id: videoId,
        video_name: videoName,
        video_description: videoDescription,
        video_url: videoUrl,
        video_added_date: videoAddeddate,
        video_path: videoPath,
        video_length: videoLength,
      });
    });
  });

  describe("getAllVideos", () => {
    it("should return all videos in the database", async () => {
      const video1 = {
        video_id: "uBvlflKbn7A",
        video_name: "Test Video 1",
        video_description: "This is a test video 1",
        video_url: "https://www.youtube.com/watch?v=uBvlflKbn7A",
        video_added_date: "2022-01-01",
        video_path: "/path/to/test1.mp4",
        video_length: "10:00",
      };

      const video2 = {
        video_id: "45",
        video_name: "Test Video 2",
        video_description: "This is a test video 2",
        video_url: "https://example.com/test2.mp4",
        video_added_date: "2022-01-02",
        video_path: "/path/to/test2.mp4",
        video_length: "20:00",
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
      assertEquals(videos.length, 2);
      assertObjectMatch(videos[0], video1);
      assertObjectMatch(videos[1], video2);
    });
  });

  describe("isVideoExists", () => {
    it("should return true if the video exists in the database", async () => {
      const videoId = "123";

      await addVideoToDb(
        videoId,
        "Test Video",
        null,
        "https://example.com/test.mp4",
        "2022-01-01",
        "/path/to/test.mp4",
        "10:00",
      );

      const exists = isVideoExists(videoId);
      assertEquals(exists, true);
    });

    it("should return false if the video does not exist in the database", () => {
      const exists = isVideoExists("123");
      assertEquals(exists, false);
    });
  });
});
