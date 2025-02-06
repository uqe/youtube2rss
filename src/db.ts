import { Database } from "bun:sqlite";

export const dbName = () => (Bun.env.IS_TEST ? "youtube2rss.test.db" : "youtube2rss.db");

export const createDb = async () => {
  const dbFile = Bun.file(dbName());
  if ((await dbFile.exists()) && !Bun.env.IS_TEST) {
    console.log("Database already exists");
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

  if (!Bun.env.IS_TEST) {
    console.log("Database created!");
  }
};

export const addVideoToDb = async (
  videoId: string,
  videoName: string,
  videoDescription: string | null,
  videoUrl: string,
  videoAddeddate: string,
  videoPath: string,
  videoLength: number
) => {
  const db = new Database(dbName(), { readwrite: true });

  db.run(
    "INSERT INTO videos (video_id, video_name, video_description, video_url, video_added_date, video_path, video_length) VALUES (?,?,?,?,?,?,?)",
    [videoId, videoName, videoDescription, videoUrl, videoAddeddate, videoPath, videoLength]
  );

  db.close();
};

export const getAllVideos = () => {
  const db = new Database(dbName(), { readwrite: true });

  const query = db.query<
    {
      video_id: string;
      video_name: string;
      video_description: string | null;
      video_url: string;
      video_added_date: string;
      video_path: string;
      video_length: number;
    },
    null
  >("SELECT * FROM videos");
  const videos = query.all(null);
  db.close();
  return videos;
};

export const isVideoExists = (videoId: string) => {
  const db = new Database(dbName(), { readwrite: true });
  const query = db.query<[{ string: number }], string>("SELECT EXISTS (SELECT * FROM videos WHERE video_id = ?)");
  const video = query.all(videoId);
  db.close();
  return Boolean(Object.values(video[0])[0]);
};
