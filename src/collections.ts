import { defaultDatabaseFactory, runWithDb } from "./db.ts";
import type { DatabaseFactory } from "./db.ts";
import type { Video } from "./types.ts";

export interface Collection {
  id: string;
  name: string;
  createdAt: string;
}
interface CollectionRow {
  id: string;
  name: string;
  created_at: string;
}
const toCollection = (row: CollectionRow): Collection => ({ id: row.id, name: row.name, createdAt: row.created_at });
export const createCollectionRepository = (dbFactory: DatabaseFactory = defaultDatabaseFactory) => ({
  list(): Collection[] {
    return runWithDb(
      (db) =>
        db
          .query<CollectionRow, null>("SELECT * FROM collections ORDER BY name COLLATE NOCASE")
          .all(null)
          .map(toCollection),
      dbFactory,
    );
  },
  get(id: string): Collection | null {
    return runWithDb((db) => {
      const row = db.query<CollectionRow, string>("SELECT * FROM collections WHERE id = ?").get(id);
      return row ? toCollection(row) : null;
    }, dbFactory);
  },
  create(name: string): Collection {
    const normalized = name.trim();
    if (!normalized || normalized.length > 80) {
      throw new Error("Collection name must contain 1–80 characters");
    }
    return runWithDb(
      (db) =>
        db
          .transaction(() => {
            const existing = db
              .query<CollectionRow, string>("SELECT * FROM collections WHERE name = ? COLLATE NOCASE")
              .get(normalized);
            if (existing) {
              return toCollection(existing);
            }
            const collection = { id: crypto.randomUUID(), name: normalized, createdAt: new Date().toISOString() };
            db.run("INSERT INTO collections(id,name,created_at) VALUES(?,?,?)", [
              collection.id,
              collection.name,
              collection.createdAt,
            ]);
            return collection;
          })
          .immediate(),
      dbFactory,
    );
  },
  add(collectionId: string, videoId: string) {
    runWithDb(
      (db) =>
        db.run("INSERT OR IGNORE INTO collection_videos(collection_id,video_id) VALUES(?,?)", [collectionId, videoId]),
      dbFactory,
    );
  },
  remove(collectionId: string, videoId: string) {
    runWithDb(
      (db) => db.run("DELETE FROM collection_videos WHERE collection_id = ? AND video_id = ?", [collectionId, videoId]),
      dbFactory,
    );
  },
  videos(collectionId: string): Video[] {
    return runWithDb(
      (db) =>
        db
          .query<Video, string>(`SELECT v.video_id, v.video_name, v.video_description, v.video_url,
      v.video_added_date, v.video_path, v.video_artwork_path, v.video_chapters_path, v.video_length
      FROM videos v JOIN collection_videos c ON c.video_id = v.video_id
      WHERE c.collection_id = ? AND v.is_deleted = 0 ORDER BY v.id`)
          .all(collectionId),
      dbFactory,
    );
  },
});
export type CollectionRepository = ReturnType<typeof createCollectionRepository>;
export const collectionRepository = createCollectionRepository();
