import { defaultDatabaseFactory, runWithDb } from "./db.ts";
import type { DatabaseFactory } from "./db.ts";
import type { DownloadProgress } from "./download.ts";

export type JobKind = "download" | "delete" | "refresh" | "collection-add" | "collection-remove";
export interface JobInput {
  kind: JobKind;
  videoId?: string;
  collectionId?: string;
}
export interface Job extends JobInput {
  id: string;
  status: "queued" | "processing" | "completed";
  progress: DownloadProgress;
  result: string | null;
  attempts: number;
  createdAt: number;
  updatedAt: number;
}
interface JobRow {
  id: string;
  kind: JobKind;
  video_id: string | null;
  collection_id: string | null;
  status: Job["status"];
  progress: string;
  result: string | null;
  attempts: number;
  created_at: number;
  updated_at: number;
  owner_pid: number | null;
  owner_token: string | null;
}
export interface JobMessage {
  job: Job;
  chatId: number;
  messageId: number;
  signature: string;
}
const toJob = (row: JobRow | null): Job => {
  if (!row) {
    throw new Error("Job disappeared during transaction");
  }
  return {
    id: row.id,
    kind: row.kind,
    videoId: row.video_id ?? undefined,
    collectionId: row.collection_id ?? undefined,
    status: row.status,
    progress: JSON.parse(row.progress),
    result: row.result,
    attempts: row.attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};
const queuedProgress = () => JSON.stringify({ stage: "queued", percent: 0, message: "Waiting to start" });
export const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
};

export const createJobRepository = ({
  dbFactory = defaultDatabaseFactory,
  now = Date.now,
  processAlive = isProcessAlive,
}: { dbFactory?: DatabaseFactory; now?: () => number; processAlive?: (pid: number) => boolean } = {}) => {
  const use = <T>(handler: Parameters<typeof runWithDb<T>>[0]) => runWithDb(handler, dbFactory);
  const enqueue = (input: JobInput): Job =>
    use((db) =>
      db
        .transaction(() => {
          const baseKey = JSON.stringify([input.kind, input.videoId ?? null, input.collectionId ?? null]);
          const key = input.kind === "refresh" ? `${baseKey}:${crypto.randomUUID()}` : baseKey;
          const existing = db
            .query<JobRow, string>(
              input.kind === "refresh"
                ? "SELECT * FROM jobs WHERE kind = 'refresh' AND status = 'queued' AND ? IS NOT NULL"
                : "SELECT * FROM jobs WHERE dedupe_key = ? AND status != 'completed'",
            )
            .get(key);
          if (existing) {
            return toJob(existing);
          }
          const id = crypto.randomUUID();
          const timestamp = now();
          db.run(
            `INSERT INTO jobs(id,kind,video_id,collection_id,progress,available_at,created_at,updated_at,dedupe_key)
      VALUES(?,?,?,?,?,?,?,?,?)`,
            [
              id,
              input.kind,
              input.videoId ?? null,
              input.collectionId ?? null,
              queuedProgress(),
              timestamp,
              timestamp,
              timestamp,
              key,
            ],
          );
          return toJob(db.query<JobRow, string>("SELECT * FROM jobs WHERE id = ?").get(id));
        })
        .immediate(),
    );
  return {
    enqueue,
    get(id: string): Job | null {
      return use((db) => {
        const row = db.query<JobRow, string>("SELECT * FROM jobs WHERE id = ?").get(id);
        return row ? toJob(row) : null;
      });
    },
    list(limit = 50): Job[] {
      return use((db) =>
        db
          .query<JobRow, number>("SELECT * FROM jobs ORDER BY created_at DESC, rowid DESC LIMIT ?")
          .all(limit)
          .map(toJob),
      );
    },
    claim(ownerToken: string, ownerPid = process.pid): Job | null {
      return use((db) =>
        db
          .transaction(() => {
            const active = db.query<JobRow, null>("SELECT * FROM jobs WHERE status = 'processing'").all(null);
            for (const job of active) {
              if (job.owner_pid && processAlive(job.owner_pid) && job.owner_token !== ownerToken) {
                return null;
              }
              db.run(
                "UPDATE jobs SET status = 'queued', owner_pid = NULL, owner_token = NULL, progress = ?, available_at = ?, updated_at = ? WHERE id = ?",
                [queuedProgress(), now(), now(), job.id],
              );
            }
            // Strict FIFO also keeps delayed retries ahead of later destructive operations.
            const next = db
              .query<JobRow & { available_at: number }, null>(
                "SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at, rowid LIMIT 1",
              )
              .get(null);
            if (!next || next.available_at > now()) {
              return null;
            }
            db.run(
              "UPDATE jobs SET status = 'processing', owner_pid = ?, owner_token = ?, attempts = attempts + 1, updated_at = ? WHERE id = ?",
              [ownerPid, ownerToken, now(), next.id],
            );
            return toJob({ ...next, status: "processing", attempts: next.attempts + 1, updated_at: now() });
          })
          .immediate(),
      );
    },
    progress(id: string, ownerToken: string, progress: DownloadProgress) {
      use((db) =>
        db.run(
          "UPDATE jobs SET progress = ?, updated_at = ? WHERE id = ? AND owner_token = ? AND status = 'processing'",
          [JSON.stringify(progress), now(), id, ownerToken],
        ),
      );
    },
    finish(id: string, ownerToken: string, result: string, retryDelayMs?: number) {
      const retry = result === "failed" && retryDelayMs !== undefined;
      const progress = retry
        ? { stage: "queued", percent: 0, message: "Will retry automatically" }
        : {
            stage: result === "failed" ? "failed" : "completed",
            percent: result === "failed" ? 0 : 100,
            message: result === "failed" ? "Processing failed. You can retry." : "Feed updated",
          };
      use((db) =>
        db.run(
          `UPDATE jobs SET status = ?, result = ?, progress = ?, owner_pid = NULL, owner_token = NULL,
        available_at = ?, updated_at = ? WHERE id = ? AND owner_token = ? AND status = 'processing'`,
          [
            retry ? "queued" : "completed",
            retry ? null : result,
            JSON.stringify(progress),
            now() + (retryDelayMs ?? 0),
            now(),
            id,
            ownerToken,
          ],
        ),
      );
    },
    retry(id: string): Job | null {
      return use((db) =>
        db
          .transaction(() => {
            const old = db.query<JobRow, string>("SELECT * FROM jobs WHERE id = ?").get(id);
            if (!old || old.status !== "completed" || old.result !== "failed") {
              return null;
            }
            // A new request may already be queued for this operation.
            const active = db
              .query<JobRow, string>(
                old.kind === "refresh"
                  ? "SELECT * FROM jobs WHERE kind = 'refresh' AND status = 'queued' AND ? IS NOT NULL"
                  : "SELECT * FROM jobs WHERE dedupe_key = (SELECT dedupe_key FROM jobs WHERE id = ?) AND status != 'completed'",
              )
              .get(id);
            if (active) {
              return toJob(active);
            }
            db.run(
              "UPDATE jobs SET status = 'queued', result = NULL, attempts = 0, progress = ?, available_at = ?, updated_at = ? WHERE id = ?",
              [queuedProgress(), now(), now(), id],
            );
            db.run("UPDATE job_messages SET delivered = 0, signature = '' WHERE job_id = ?", [id]);
            return toJob(db.query<JobRow, string>("SELECT * FROM jobs WHERE id = ?").get(id));
          })
          .immediate(),
      );
    },
    recoverPending() {
      const ids = use((db) =>
        db
          .query<
            { video_id: string },
            null
          >(`SELECT video_id FROM videos v WHERE publication_status = 'pending' AND is_deleted = 0
        AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.video_id = v.video_id AND j.kind = 'download')`)
          .all(null),
      );
      for (const { video_id } of ids) {
        enqueue({ kind: "download", videoId: video_id });
      }
    },
    subscribe(jobId: string, chatId: number, messageId: number) {
      use((db) =>
        db.run("INSERT OR IGNORE INTO job_messages(job_id,chat_id,message_id) VALUES(?,?,?)", [
          jobId,
          chatId,
          messageId,
        ]),
      );
    },
    messages(): JobMessage[] {
      return use((db) =>
        db
          .query<JobRow & { chat_id: number; message_id: number; signature: string }, null>(
            "SELECT j.*, m.chat_id, m.message_id, m.signature FROM job_messages m JOIN jobs j ON j.id = m.job_id WHERE m.delivered = 0 ORDER BY j.created_at LIMIT 100",
          )
          .all(null)
          .map((row) => ({
            job: toJob(row),
            chatId: row.chat_id,
            messageId: row.message_id,
            signature: row.signature,
          })),
      );
    },
    acknowledge(message: JobMessage, signature: string, delivered: boolean) {
      use((db) =>
        db.run(
          "UPDATE job_messages SET signature = ?, delivered = ? WHERE job_id = ? AND chat_id = ? AND message_id = ?",
          [signature, Number(delivered), message.job.id, message.chatId, message.messageId],
        ),
      );
    },
  };
};
export type JobRepository = ReturnType<typeof createJobRepository>;
export const jobRepository = createJobRepository();
