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

export const latestDatabaseVersion = 1;

export type PublicationStatus = "pending" | "published";

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
  db.run(`PRAGMA user_version = ${latestDatabaseVersion}`);
};

const migrateDatabase = (db: Database) => {
  const version = getDatabaseVersion(db);

  if (version > latestDatabaseVersion) {
    throw new Error(`Database version ${version} is newer than supported version ${latestDatabaseVersion}`);
  }

  if (version < 1) {
    db.transaction(() => migrateToVersionOne(db))();
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
  exists(videoId: string): boolean;
  getPublicationStatus(videoId: string): PublicationStatus | null;
  markPublished(videoId: string): void;
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
        db.run(
          "INSERT INTO videos (video_id, video_name, video_description, video_url, video_added_date, video_path, video_length, publication_status) VALUES (?,?,?,?,?,?,?,?)",
          [
            video.video_id,
            video.video_name,
            video.video_description,
            video.video_url,
            video.video_added_date,
            video.video_path,
            video.video_length,
            publicationStatus,
          ]
        );
      }, dbFactory);
    },
    list() {
      return runWithDb((db) => {
        const query = db.query<Video, null>(
          "SELECT video_id, video_name, video_description, video_url, video_added_date, video_path, video_length FROM videos ORDER BY id"
        );
        return query.all(null);
      }, dbFactory);
    },
    exists(videoId: string) {
      return runWithDb((db) => {
        const query = db.query<{ exists_flag: number }, string>(
          "SELECT EXISTS (SELECT 1 FROM videos WHERE video_id = ?) as exists_flag"
        );
        const result = query.get(videoId);
        return Boolean(result?.exists_flag);
      }, dbFactory);
    },
    getPublicationStatus(videoId: string) {
      return runWithDb((db) => {
        const query = db.query<{ publication_status: PublicationStatus }, string>(
          "SELECT publication_status FROM videos WHERE video_id = ?"
        );
        return query.get(videoId)?.publication_status ?? null;
      }, dbFactory);
    },
    markPublished(videoId: string) {
      runWithDb((db) => {
        db.run("UPDATE videos SET publication_status = 'published' WHERE video_id = ?", [videoId]);
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
