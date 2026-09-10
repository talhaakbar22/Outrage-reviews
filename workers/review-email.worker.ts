import { config } from "dotenv";
import { Worker } from "bullmq";
import { getRedisConnection } from "../lib/redis";
import {
  PHOTO_REMINDER_QUEUE_NAME,
  REVIEW_REQUEST_QUEUE_NAME,
  REVIEW_REMINDER_QUEUE_NAME,
  type PhotoReminderJobData,
  type ReviewRequestJobData,
  type ReviewReminderJobData,
} from "../lib/queue";
import {
  sendPhotoReminderEmail,
  sendReviewRequestEmail,
  sendReviewReminderEmail,
} from "../services/email/delivery";

config();

const requestWorker = new Worker<ReviewRequestJobData>(
  REVIEW_REQUEST_QUEUE_NAME,
  async (job) => {
    await sendReviewRequestEmail(job.data);
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
  },
);

const reminderWorker = new Worker<ReviewReminderJobData>(
  REVIEW_REMINDER_QUEUE_NAME,
  async (job) => {
    await sendReviewReminderEmail(job.data);
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
  },
);

const photoReminderWorker = new Worker<PhotoReminderJobData>(
  PHOTO_REMINDER_QUEUE_NAME,
  async (job) => {
    await sendPhotoReminderEmail(job.data);
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
  },
);

requestWorker.on("completed", (job) => {
  console.log(`Sent review request email for ${job.data.requestId}`);
});

requestWorker.on("failed", (job, error) => {
  console.error(
    `Review request email failed for ${job?.data.requestId ?? "unknown"}:`,
    error,
  );
});

reminderWorker.on("completed", (job) => {
  console.log(`Sent review reminder email for ${job.data.requestId}`);
});

reminderWorker.on("failed", (job, error) => {
  console.error(
    `Review reminder email failed for ${job?.data.requestId ?? "unknown"}:`,
    error,
  );
});

photoReminderWorker.on("completed", (job) => {
  console.log(`Sent photo reminder email for ${job.data.reviewId}`);
});

photoReminderWorker.on("failed", (job, error) => {
  console.error(
    `Photo reminder email failed for ${job?.data.reviewId ?? "unknown"}:`,
    error,
  );
});

console.log(
  `Review email workers listening on "${REVIEW_REQUEST_QUEUE_NAME}", "${REVIEW_REMINDER_QUEUE_NAME}", and "${PHOTO_REMINDER_QUEUE_NAME}"`,
);
