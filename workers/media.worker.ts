import { config } from "dotenv";
import { Worker } from "bullmq";
import { getRedisConnection } from "../lib/redis";
import { MEDIA_QUEUE_NAME, type MediaProcessingJobData } from "../lib/queue";
import { processReviewMedia } from "../services/media/processor";

config();

const worker = new Worker<MediaProcessingJobData>(
  MEDIA_QUEUE_NAME,
  async (job) => {
    await processReviewMedia(job.data);
  },
  {
    connection: getRedisConnection(),
    concurrency: 2,
  },
);

worker.on("completed", (job) => {
  console.log(`Processed review media ${job.data.reviewMediaId}`);
});

worker.on("failed", (job, error) => {
  console.error(
    `Media job failed for ${job?.data.reviewMediaId ?? "unknown"}:`,
    error,
  );
});

console.log(`Media worker listening on queue "${MEDIA_QUEUE_NAME}"`);
