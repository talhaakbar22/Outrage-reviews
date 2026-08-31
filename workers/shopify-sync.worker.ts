import { config } from "dotenv";
import { Worker } from "bullmq";
import { getRedisConnection } from "../lib/redis";
import { SYNC_QUEUE_NAME, type SyncJobData } from "../lib/queue";
import { loadOfflineSessionByShopId } from "../services/shop/service";
import { createShopifySyncService } from "../lib/shopify/sync";

config();

const worker = new Worker<SyncJobData>(
  SYNC_QUEUE_NAME,
  async (job) => {
    const session = await loadOfflineSessionByShopId(job.data.shopId);

    if (!session) {
      throw new Error(`No offline session for shop ${job.data.shopId}`);
    }

    await createShopifySyncService(session).runInitialSync(job.data.shopId);
  },
  {
    connection: getRedisConnection(),
    concurrency: 2,
  },
);

worker.on("completed", (job) => {
  console.log(`Completed initial sync for shop ${job.data.shopId}`);
});

worker.on("failed", (job, error) => {
  console.error(
    `Initial sync failed for shop ${job?.data.shopId ?? "unknown"}:`,
    error,
  );
});

console.log(`Sync worker listening on queue "${SYNC_QUEUE_NAME}"`);
