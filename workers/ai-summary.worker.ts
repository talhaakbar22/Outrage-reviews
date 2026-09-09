import { config } from "dotenv";
import { Worker } from "bullmq";
import { getDb } from "../lib/prisma";
import { getRedisConnection } from "../lib/redis";
import {
  AI_SUMMARY_QUEUE_NAME,
  type AiSummaryJobData,
} from "../lib/queue";
import { generateAndStoreProductSummary } from "../services/reviews/ai-summary";

config();

const worker = new Worker<AiSummaryJobData>(
  AI_SUMMARY_QUEUE_NAME,
  async (job) => {
    const db = getDb();
    const product = await db.orm.public.Product.where({
      id: job.data.productId,
    }).first();
    await generateAndStoreProductSummary({
      shopId: job.data.shopId,
      productId: job.data.productId,
      productTitle: product?.title ?? null,
      avgRating: product?.avgRating ?? null,
      force: true,
    });
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
  },
);

worker.on("completed", (job) => {
  console.log(`Generated AI summary for product ${job.data.productId}`);
});

worker.on("failed", (job, error) => {
  console.error(
    `AI summary failed for ${job?.data.productId ?? "unknown"}:`,
    error,
  );
});

console.log(`AI summary worker listening on "${AI_SUMMARY_QUEUE_NAME}"`);
