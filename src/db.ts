import { Database } from "bun:sqlite";
import { getDbFileName, isTestEnv } from "./config.ts";
import { logger } from "./logger.ts";
import type { Video } from "./types.ts";

export const dbName = () => getDbFileName();

const runWithDb = <T>(handler: (db: Database) => T) => {
  const db = new Database(dbName(), { readwrite: true });
  try {
    return handler(db);
  } finally {
    db.close();
  }
};

export const createDb = async () => {
  const dbFile = Bun.file(dbName());
  if ((await dbFile.exists()) && !isTestEnv()) {
    logger.info("Database already exists");
    return;
  }

  const db = new Database(dbName(), { create: true });
  db.run(`
    CREATE TABLE IF NOT EXISTS videos (
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

  db.close();

  if (!isTestEnv()) {
    logger.success("Database created!");
  }
};

export interface VideoRepository {
  create(video: Video): void;
  list(): Video[];
  exists(videoId: string): boolean;
}

export const createVideoRepository = (): VideoRepository => {
  return {
    create(video: Video) {
      runWithDb((db) => {
        db.run(
          "INSERT INTO videos (video_id, video_name, video_description, video_url, video_added_date, video_path, video_length) VALUES (?,?,?,?,?,?,?)",
          [
            video.video_id,
            video.video_name,
            video.video_description,
            video.video_url,
            video.video_added_date,
            video.video_path,
            video.video_length,
          ]
        );
      });
    },
    list() {
      return runWithDb((db) => {
        const query = db.query<Video, null>("SELECT * FROM videos");
        return query.all(null);
      });
    },
    exists(videoId: string) {
      return runWithDb((db) => {
        const query = db.query<{ exists_flag: number }, string>(
          "SELECT EXISTS (SELECT 1 FROM videos WHERE video_id = ?) as exists_flag"
        );
        const result = query.get(videoId);
        return Boolean(result?.exists_flag);
      });
    },
  };
};

export const videoRepository = createVideoRepository();

export const addVideoToDb = async (
  videoId: string,
  videoName: string,
  videoDescription: string | null,
  videoUrl: string,
  videoAddeddate: string,
  videoPath: string,
  videoLength: number
) => {
  videoRepository.create({
    video_id: videoId,
    video_name: videoName,
    video_description: videoDescription,
    video_url: videoUrl,
    video_added_date: videoAddeddate,
    video_path: videoPath,
    video_length: videoLength,
  });
};

export const getAllVideos = () => videoRepository.list();

export const isVideoExists = (videoId: string) => videoRepository.exists(videoId);
