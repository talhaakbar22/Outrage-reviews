import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { Worker } from "bullmq";
import { getRedisConnection } from "../lib/redis";
import { LOOX_IMPORT_QUEUE_NAME, type LooxImportJobData } from "../lib/queue";
import { runLooxImport } from "../services/import/loox/runner";
import { loadOfflineSessionByShopId } from "../services/shop/service";

config();

const worker = new Worker<LooxImportJobData>(
  LOOX_IMPORT_QUEUE_NAME,
  async (job) => {
    const session = await loadOfflineSessionByShopId(job.data.shopId);

    if (!session) {
      throw new Error(`No offline session for shop ${job.data.shopId}`);
    }

    const csvContent = await readFile(job.data.csvPath, "utf8");

    await runLooxImport({
      shopId: job.data.shopId,
      syncJobId: job.data.syncJobId,
      csvContent,
      session,
    });
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
  },
);

worker.on("completed", (job) => {
  console.log(`Completed Loox import job ${job.data.syncJobId}`);
});

worker.on("failed", (job, error) => {
  console.error(
    `Loox import failed for job ${job?.data.syncJobId ?? "unknown"}:`,
    error,
  );
});

console.log(`Loox import worker listening on queue "${LOOX_IMPORT_QUEUE_NAME}"`);
