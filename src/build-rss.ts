import { loadAppConfig } from "./config.ts";
import { createDb } from "./db.ts";
import { createJobWorker } from "./job-worker.ts";
import { jobRepository } from "./jobs.ts";

export const buildRss = async () => {
  loadAppConfig();
  await createDb();
  console.log("Building RSS feed...");
  const job = jobRepository.enqueue({ kind: "refresh" });
  const worker = createJobWorker();
  for (;;) {
    const current = jobRepository.get(job.id);
    if (current?.status === "completed") {
      if (current.result === "failed") {
        throw new Error("RSS publication failed; check worker logs");
      }
      break;
    }
    await worker.runOnce();
    if (jobRepository.get(job.id)?.status !== "completed") {
      await Bun.sleep(500);
    }
  }
  console.log("RSS feed built.");
};
if (import.meta.main) {
  await buildRss();
}
