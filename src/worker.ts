import { Api } from "grammy";

import { getBotToken, loadAppConfig } from "./config.ts";
import { createDb } from "./db.ts";
import { createJobWorker } from "./job-worker.ts";
import { jobRepository } from "./jobs.ts";
import { logger } from "./logger.ts";
import { registerShutdownHandlers } from "./shutdown.ts";
import { createJobNotifier } from "./telegram-jobs.ts";

export const startWorker = async () => {
  loadAppConfig();
  await createDb();
  jobRepository.recoverPending();
  const worker = createJobWorker();
  const token = getBotToken();
  const notify = token ? createJobNotifier(new Api(token)) : async () => {};
  let stopping = false;
  let active: Promise<unknown> | undefined;
  const tick = () => {
    if (stopping || active) {
      return;
    }
    active = worker
      .runOnce()
      .catch((error) => logger.error(`Worker failed: ${String(error)}`))
      .finally(() => {
        active = undefined;
      });
  };
  const interval = setInterval(tick, 1000);
  const notifications = setInterval(() => {
    void notify().catch((error) => logger.error(`Notification failed: ${String(error)}`));
  }, 1500);
  tick();
  const stop = async () => {
    stopping = true;
    clearInterval(interval);
    clearInterval(notifications);
    await active;
    await notify();
  };
  registerShutdownHandlers({ shutdown: stop });
  logger.success("Media worker is running");
  return { stop };
};
if (import.meta.main) {
  await startWorker();
}
