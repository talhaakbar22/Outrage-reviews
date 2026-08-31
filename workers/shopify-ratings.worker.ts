import { config } from "dotenv";
import { Worker } from "bullmq";
import { getRedisConnection } from "../lib/redis";
import {
  SHOPIFY_RATINGS_QUEUE_NAME,
  type ShopifyRatingsJobData,
} from "../lib/queue";
import { syncProductRatingMetafields } from "../services/reviews/ratings";

config();

const worker = new Worker<ShopifyRatingsJobData>(
  SHOPIFY_RATINGS_QUEUE_NAME,
  async (job) => {
    await syncProductRatingMetafields(job.data.productId);
  },
  {
    connection: getRedisConnection(),
    concurrency: 3,
  },
);

worker.on("completed", (job) => {
  console.log(`Synced Shopify ratings for product ${job.data.productId}`);
});

worker.on("failed", (job, error) => {
  console.error(
    `Shopify ratings sync failed for ${job?.data.productId ?? "unknown"}:`,
    error,
  );
});

console.log(`Shopify ratings worker listening on "${SHOPIFY_RATINGS_QUEUE_NAME}"`);
