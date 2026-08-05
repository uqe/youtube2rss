import { getDbFileName, isTestEnv } from "./config.ts";
import { logger } from "./logger.ts";
import type { Video } from "./types.ts";
import { Database } from "bun:sqlite";

type DatabaseOptions = ConstructorParameters<typeof Database>[1];

interface DbLogger {
  info(message: string): void;
  success(message: string): void;
}

export interface DatabaseFactory {
  fileName(): string;
  open(options?: DatabaseOptions): Database;
}

export const createDatabaseFactory = (getFileName: () => string = getDbFileName): DatabaseFactory => ({
  fileName: getFileName,
  open(options?: DatabaseOptions) {
    return new Database(getFileName(), options);
  },
});

const defaultDatabaseFactory = createDatabaseFactory();

export const latestDatabaseVersion = 4;

export type PublicationStatus = "pending" | "published";

export interface StoredVideo extends Video {
  publication_status: PublicationStatus;
  is_deleted: boolean;
}

export const dbName = () => defaultDatabaseFactory.fileName();

const runWithDb = <T>(handler: (db: Database) => T, dbFactory: DatabaseFactory = defaultDatabaseFactory) => {
  const db = dbFactory.open({ readwrite: true });
  try {
    return handler(db);
  } finally {
    db.close();
  }
};

interface CreateDbOptions {
  dbFactory?: DatabaseFactory;
  isTestEnvironment?: () => boolean;
  log?: DbLogger;
}

const getDatabaseVersion = (db: Database) => {
  const result = db.query("PRAGMA user_version").get() as { user_version: number } | null;
  return result?.user_version ?? 0;
};

const migrateToVersionOne = (db: Database) => {
  db.run(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT NOT NULL,
      video_name TEXT NOT NULL,
      video_description TEXT,
      video_url TEXT NOT NULL,
      video_added_date TEXT NOT NULL,
      video_path TEXT NOT NULL,
      video_length INTEGER NOT NULL,
      publication_status TEXT NOT NULL DEFAULT 'published'
        CHECK (publication_status IN ('pending', 'published'))
    )
  `);

  const columns = db.query("PRAGMA table_info(videos)").all() as Array<{ name: string }>;
  if (!columns.some(({ name }) => name === "publication_status")) {
    db.run(
      "ALTER TABLE videos ADD COLUMN publication_status TEXT NOT NULL DEFAULT 'published' CHECK (publication_status IN ('pending', 'published'))"
    );
  }

  const duplicate = db
    .query<{ video_id: string }, null>("SELECT video_id FROM videos GROUP BY video_id HAVING COUNT(*) > 1 LIMIT 1")
    .get(null);

  if (duplicate) {
    throw new Error(`Cannot add unique video_id index: duplicate value ${duplicate.video_id}`);
  }

  db.run("CREATE UNIQUE INDEX IF NOT EXISTS videos_video_id_unique ON videos (video_id)");
  db.run("PRAGMA user_version = 1");
};

const migrateToVersionTwo = (db: Database) => {
  const columns = db.query("PRAGMA table_info(videos)").all() as Array<{ name: string }>;
  if (!columns.some(({ name }) => name === "is_deleted")) {
    db.run("ALTER TABLE videos ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1))");
  }

  db.run("PRAGMA user_version = 2");
};

const migrateToVersionThree = (db: Database) => {
  const columns = db.query("PRAGMA table_info(videos)").all() as Array<{ name: string }>;
  if (!columns.some(({ name }) => name === "video_artwork_path")) {
    db.run("ALTER TABLE videos ADD COLUMN video_artwork_path TEXT");
  }

  db.run("PRAGMA user_version = 3");
};

const migrateToVersionFour = (db: Database) => {
  const columns = db.query("PRAGMA table_info(videos)").all() as Array<{ name: string }>;
  if (!columns.some(({ name }) => name === "video_chapters_path")) {
    db.run("ALTER TABLE videos ADD COLUMN video_chapters_path TEXT");
  }

  db.run("PRAGMA user_version = 4");
};

const migrateDatabase = (db: Database) => {
  const version = getDatabaseVersion(db);

  if (version > latestDatabaseVersion) {
    throw new Error(`Database version ${version} is newer than supported version ${latestDatabaseVersion}`);
  }

  if (version < 1) {
    db.transaction(() => migrateToVersionOne(db))();
  }

  if (version < 2) {
    db.transaction(() => migrateToVersionTwo(db))();
  }

  if (version < 3) {
    db.transaction(() => migrateToVersionThree(db))();
  }

  if (version < 4) {
    db.transaction(() => migrateToVersionFour(db))();
  }
};

export const createDb = async ({
  dbFactory = defaultDatabaseFactory,
  isTestEnvironment = isTestEnv,
  log = logger,
}: CreateDbOptions = {}) => {
  const dbFile = Bun.file(dbFactory.fileName());
  const databaseExists = await dbFile.exists();

  const db = dbFactory.open({ create: true });
  try {
    migrateDatabase(db);
  } finally {
    db.close();
  }

  if (!isTestEnvironment()) {
    if (databaseExists) {
      log.info("Database is up to date");
    } else {
      log.success("Database created!");
    }
  }
};

export interface VideoRepository {
  create(video: Video, publicationStatus?: PublicationStatus): void;
  list(): Video[];
  findById(videoId: string): StoredVideo | null;
  exists(videoId: string): boolean;
  getPublicationStatus(videoId: string): PublicationStatus | null;
  markPublished(videoId: string): void;
  markDeleted(videoId: string): void;
  markActive(videoId: string): void;
}

interface VideoRepositoryOptions {
  dbFactory?: DatabaseFactory;
}

export const createVideoRepository = ({
  dbFactory = defaultDatabaseFactory,
}: VideoRepositoryOptions = {}): VideoRepository => {
  return {
    create(video: Video, publicationStatus: PublicationStatus = "published") {
      runWithDb((db) => {
        const values = [
          video.video_id,
          video.video_name,
          video.video_description,
          video.video_url,
          video.video_added_date,
          video.video_path,
          video.video_artwork_path ?? null,
          video.video_chapters_path ?? null,
          video.video_length,
          publicationStatus,
        ];
        const existing = db
          .query<{ is_deleted: number }, string>("SELECT is_deleted FROM videos WHERE video_id = ?")
          .get(video.video_id);

        if (existing?.is_deleted) {
          db.run(
            `UPDATE videos SET
              video_name = ?, video_description = ?, video_url = ?, video_added_date = ?, video_path = ?,
              video_artwork_path = ?, video_chapters_path = ?, video_length = ?, publication_status = ?, is_deleted = 0
            WHERE video_id = ?`,
            [...values.slice(1), video.video_id]
          );
          return;
        }

        db.run(
          "INSERT INTO videos (video_id, video_name, video_description, video_url, video_added_date, video_path, video_artwork_path, video_chapters_path, video_length, publication_status) VALUES (?,?,?,?,?,?,?,?,?,?)",
          values
        );
      }, dbFactory);
    },
    list() {
      return runWithDb((db) => {
        const query = db.query<Video, null>(
          "SELECT video_id, video_name, video_description, video_url, video_added_date, video_path, video_artwork_path, video_chapters_path, video_length FROM videos WHERE is_deleted = 0 ORDER BY id"
        );
        return query.all(null);
      }, dbFactory);
    },
    findById(videoId: string) {
      return runWithDb((db) => {
        const query = db.query<Omit<StoredVideo, "is_deleted"> & { is_deleted: number }, string>(
          "SELECT video_id, video_name, video_description, video_url, video_added_date, video_path, video_artwork_path, video_chapters_path, video_length, publication_status, is_deleted FROM videos WHERE video_id = ?"
        );
        const video = query.get(videoId);
        return video ? { ...video, is_deleted: Boolean(video.is_deleted) } : null;
      }, dbFactory);
    },
    exists(videoId: string) {
      return runWithDb((db) => {
        const query = db.query<{ exists_flag: number }, string>(
          "SELECT EXISTS (SELECT 1 FROM videos WHERE video_id = ? AND is_deleted = 0) as exists_flag"
        );
        const result = query.get(videoId);
        return Boolean(result?.exists_flag);
      }, dbFactory);
    },
    getPublicationStatus(videoId: string) {
      return runWithDb((db) => {
        const query = db.query<{ publication_status: PublicationStatus }, string>(
          "SELECT publication_status FROM videos WHERE video_id = ? AND is_deleted = 0"
        );
        return query.get(videoId)?.publication_status ?? null;
      }, dbFactory);
    },
    markPublished(videoId: string) {
      runWithDb((db) => {
        db.run("UPDATE videos SET publication_status = 'published' WHERE video_id = ?", [videoId]);
      }, dbFactory);
    },
    markDeleted(videoId: string) {
      runWithDb((db) => {
        db.run("UPDATE videos SET is_deleted = 1 WHERE video_id = ?", [videoId]);
      }, dbFactory);
    },
    markActive(videoId: string) {
      runWithDb((db) => {
        db.run("UPDATE videos SET is_deleted = 0 WHERE video_id = ?", [videoId]);
      }, dbFactory);
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
  videoLength: number,
  videoArtworkPath: string | null = null,
  videoChaptersPath: string | null = null
) => {
  videoRepository.create({
    video_id: videoId,
    video_name: videoName,
    video_description: videoDescription,
    video_url: videoUrl,
    video_added_date: videoAddeddate,
    video_path: videoPath,
    video_artwork_path: videoArtworkPath,
    video_chapters_path: videoChaptersPath,
    video_length: videoLength,
  });
};

export const getAllVideos = () => videoRepository.list();

export const isVideoExists = (videoId: string) => videoRepository.exists(videoId);
