import { DB, exists } from "./deps.ts";

const dbFile = "youtube2rss.db";

const createDb = async () => {
  if (await exists(dbFile)) {
    console.log("Database already exists");
    return;
  }

  const db = new DB(dbFile, { mode: "create" });
  db.execute(`
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
  console.log("Database created!");
};

const addVideoToDb = async (
  videoId: string,
  videoName: string,
  videoDescription: string | null,
  videoUrl: string,
  videoAddeddate: string,
  videoPath: string,
  videoLength: string,
) => {
  const db = new DB(dbFile, { mode: "write" });

  await db.query(
    "INSERT INTO videos (video_id, video_name, video_description, video_url, video_added_date, video_path, video_length) VALUES (?,?,?,?,?,?,?)",
    [videoId, videoName, videoDescription, videoUrl, videoAddeddate, videoPath, videoLength],
  );

  db.close();
};

const getAllVideos = () => {
  const db = new DB(dbFile, { mode: "read" });

  const videos = db.queryEntries<{
    id: number;
    video_id: string;
    video_name: string;
    video_description: string | null;
    video_url: string;
    video_added_date: string;
    video_path: string;
    video_length: string;
  }>("SELECT * FROM videos");
  db.close();
  return videos;
};

const isVideoExists = (videoId: string) => {
  const db = new DB(dbFile, { mode: "read" });
  const video = db.query<[[number]]>("SELECT EXISTS (SELECT * FROM videos WHERE video_id = :videoId)", { videoId });
  db.close();
  return Boolean(video[0][0]);
};

export { addVideoToDb, createDb, getAllVideos, isVideoExists };
