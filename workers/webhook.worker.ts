import { config } from "dotenv";
import { Worker } from "bullmq";
import { getRedisConnection } from "../lib/redis";
import { WEBHOOK_QUEUE_NAME, type WebhookJobData } from "../lib/queue";
import { processWebhookEvent } from "../services/webhooks/processor";

config();

const worker = new Worker<WebhookJobData>(
  WEBHOOK_QUEUE_NAME,
  async (job) => {
    await processWebhookEvent(job.data.eventId);
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
  },
);

worker.on("completed", (job) => {
  console.log(`Processed webhook event ${job.data.eventId}`);
});

worker.on("failed", (job, error) => {
  console.error(
    `Failed webhook event ${job?.data.eventId ?? "unknown"}:`,
    error,
  );
});

console.log(`Webhook worker listening on queue "${WEBHOOK_QUEUE_NAME}"`);
