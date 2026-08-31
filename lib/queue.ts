import { Queue } from "bullmq";
import { env } from "@/lib/env";
import { getRedisConnection } from "@/lib/redis";

export const WEBHOOK_QUEUE_NAME = "webhook-events";
export const SYNC_QUEUE_NAME = "shop-sync";
export const LOOX_IMPORT_QUEUE_NAME = "loox-import";
export const MEDIA_QUEUE_NAME = "review-media";
export const REVIEW_REQUEST_QUEUE_NAME = "review-request";
export const REVIEW_REMINDER_QUEUE_NAME = "review-reminder";
export const AI_SUMMARY_QUEUE_NAME = "ai-summary";
export const SHOPIFY_RATINGS_QUEUE_NAME = "shopify-ratings";

export type WebhookJobData = { eventId: string };
export type SyncJobData = { shopId: string };
export type LooxImportJobData = { shopId: string; syncJobId: string; csvPath: string };
export type MediaProcessingJobData = {
  reviewMediaId: string;
  pendingKey: string;
  shopId: string;
  reviewId: string;
};
export type ReviewRequestJobData = {
  requestId: string;
  rawToken: string;
};
export type ReviewReminderJobData = {
  requestId: string;
  rawToken: string;
};
export type AiSummaryJobData = {
  shopId: string;
  productId: string;
};
export type ShopifyRatingsJobData = {
  shopId: string;
  productId: string;
};

let webhookQueue: Queue<WebhookJobData> | undefined;
let syncQueue: Queue<SyncJobData> | undefined;
let looxImportQueue: Queue<LooxImportJobData> | undefined;
let mediaQueue: Queue<MediaProcessingJobData> | undefined;
let reviewRequestQueue: Queue<ReviewRequestJobData> | undefined;
let reviewReminderQueue: Queue<ReviewReminderJobData> | undefined;
let aiSummaryQueue: Queue<AiSummaryJobData> | undefined;
let shopifyRatingsQueue: Queue<ShopifyRatingsJobData> | undefined;

export function getWebhookQueue() {
  if (!webhookQueue) {
    webhookQueue = new Queue<WebhookJobData>(WEBHOOK_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
      },
    });
  }
  return webhookQueue;
}

export function getSyncQueue() {
  if (!syncQueue) {
    syncQueue = new Queue<SyncJobData>(SYNC_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    });
  }
  return syncQueue;
}

export function getLooxImportQueue() {
  if (!looxImportQueue) {
    looxImportQueue = new Queue<LooxImportJobData>(LOOX_IMPORT_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 200,
        attempts: 2,
        backoff: { type: "fixed", delay: 10_000 },
      },
    });
  }
  return looxImportQueue;
}

export async function enqueueLooxImport(input: {
  shopId: string;
  syncJobId: string;
  csvPath: string;
}) {
  if (env.skipBackgroundQueue()) {
    const { readFile } = await import("node:fs/promises");
    const { loadOfflineSessionByShopId } = await import("@/services/shop/service");
    const { runLooxImport } = await import("@/services/import/loox/runner");

    const session = await loadOfflineSessionByShopId(input.shopId);
    if (!session) {
      throw new Error(`No offline session found for shop ${input.shopId}`);
    }

    const csvContent = await readFile(input.csvPath, "utf8");
    await runLooxImport({
      shopId: input.shopId,
      syncJobId: input.syncJobId,
      csvContent,
      session,
    });
    return;
  }

  await getLooxImportQueue().add(
    "import",
    input,
    { jobId: `loox-import:${input.syncJobId}` },
  );
}

export async function enqueueWebhookEvent(eventId: string) {
  if (env.skipBackgroundQueue()) {
    return;
  }

  await getWebhookQueue().add("process", { eventId }, { jobId: eventId });
}

export function getMediaQueue() {
  if (!mediaQueue) {
    mediaQueue = new Queue<MediaProcessingJobData>(MEDIA_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
      },
    });
  }
  return mediaQueue;
}

export async function enqueueMediaProcessing(input: MediaProcessingJobData) {
  if (env.skipBackgroundQueue()) {
    const { processReviewMedia } = await import("@/services/media/processor");
    await processReviewMedia(input);
    return;
  }

  await getMediaQueue().add(
    "process",
    input,
    { jobId: `review-media:${input.reviewMediaId}` },
  );
}

export async function enqueueInitialSync(shopId: string) {
  if (env.skipBackgroundQueue()) {
    const { loadOfflineSessionByShopId } = await import(
      "@/services/shop/service"
    );
    const { createShopifySyncService } = await import("@/lib/shopify/sync");

    const session = await loadOfflineSessionByShopId(shopId);
    if (!session) {
      throw new Error(`No offline session found for shop ${shopId}`);
    }

    await createShopifySyncService(session).runInitialSync(shopId);
    return;
  }

  await getSyncQueue().add(
    "initial",
    { shopId },
    { jobId: `initial-sync:${shopId}` },
  );
}

function daysToDelayMs(days: number) {
  return Math.max(0, days) * 24 * 60 * 60 * 1000;
}

export function getReviewRequestQueue() {
  if (!reviewRequestQueue) {
    reviewRequestQueue = new Queue<ReviewRequestJobData>(REVIEW_REQUEST_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
      },
    });
  }
  return reviewRequestQueue;
}

export function getReviewReminderQueue() {
  if (!reviewReminderQueue) {
    reviewReminderQueue = new Queue<ReviewReminderJobData>(REVIEW_REMINDER_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
      },
    });
  }
  return reviewReminderQueue;
}

export function getAiSummaryQueue() {
  if (!aiSummaryQueue) {
    aiSummaryQueue = new Queue<AiSummaryJobData>(AI_SUMMARY_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
      },
    });
  }
  return aiSummaryQueue;
}

export function reviewRequestJobId(requestId: string) {
  return `review-request:${requestId}`;
}

export function reviewReminderJobId(requestId: string) {
  return `review-reminder:${requestId}`;
}

export async function enqueueReviewRequest(input: {
  requestId: string;
  rawToken: string;
  delayDays: number;
}) {
  const delay =
    env.reviewRequestDelayMs() ?? daysToDelayMs(input.delayDays);

  if (env.skipBackgroundQueue()) {
    if (delay > 0) {
      console.warn(
        `SKIP_BACKGROUND_QUEUE=true: sending review request immediately (configured delay ${delay}ms ignored)`,
      );
    }
    const { sendReviewRequestEmail } = await import("@/services/email/delivery");
    await sendReviewRequestEmail({
      requestId: input.requestId,
      rawToken: input.rawToken,
    });
    return;
  }

  await getReviewRequestQueue().add(
    "send",
    { requestId: input.requestId, rawToken: input.rawToken },
    {
      jobId: reviewRequestJobId(input.requestId),
      delay,
    },
  );
}

export async function enqueueReviewReminder(input: {
  requestId: string;
  rawToken: string;
  delayDays: number;
}) {
  const delay =
    env.reviewReminderDelayMs() ?? daysToDelayMs(input.delayDays);

  if (env.skipBackgroundQueue()) {
    if (delay > 0) {
      console.warn(
        `SKIP_BACKGROUND_QUEUE=true: sending review reminder immediately (configured delay ${delay}ms ignored)`,
      );
    }
    const { sendReviewReminderEmail } = await import("@/services/email/delivery");
    await sendReviewReminderEmail({
      requestId: input.requestId,
      rawToken: input.rawToken,
    });
    return;
  }

  await getReviewReminderQueue().add(
    "send",
    { requestId: input.requestId, rawToken: input.rawToken },
    {
      jobId: reviewReminderJobId(input.requestId),
      delay,
    },
  );
}

export async function cancelReviewEmailJobs(requestId: string) {
  if (env.skipBackgroundQueue()) {
    return;
  }

  const [requestQueue, reminderQueue] = [
    getReviewRequestQueue(),
    getReviewReminderQueue(),
  ];

  const requestJob = await requestQueue.getJob(reviewRequestJobId(requestId));
  if (requestJob) {
    const state = await requestJob.getState();
    if (state === "delayed" || state === "waiting" || state === "prioritized") {
      await requestJob.remove();
    }
  }

  const reminderJob = await reminderQueue.getJob(reviewReminderJobId(requestId));
  if (reminderJob) {
    const state = await reminderJob.getState();
    if (state === "delayed" || state === "waiting" || state === "prioritized") {
      await reminderJob.remove();
    }
  }
}

export function getShopifyRatingsQueue() {
  if (!shopifyRatingsQueue) {
    shopifyRatingsQueue = new Queue<ShopifyRatingsJobData>(
      SHOPIFY_RATINGS_QUEUE_NAME,
      {
        connection: getRedisConnection(),
        defaultJobOptions: {
          removeOnComplete: 1000,
          removeOnFail: 5000,
          attempts: 5,
          backoff: { type: "exponential", delay: 4000 },
        },
      },
    );
  }
  return shopifyRatingsQueue;
}

export function shopifyRatingsJobId(productId: string) {
  return `shopify-ratings:${productId}`;
}

/**
 * Queue Shopify metafield sync for a product.
 * Uses a stable jobId so rapid approvals coalesce into one pending sync.
 * A short delay batches bursty moderation into a single Admin API write.
 */
export async function enqueueProductRatingSync(input: {
  shopId: string;
  productId: string;
}) {
  if (env.skipBackgroundQueue()) {
    const { syncProductRatingMetafields } = await import(
      "@/services/reviews/ratings"
    );
    await syncProductRatingMetafields(input.productId);
    return;
  }

  const queue = getShopifyRatingsQueue();
  const jobId = shopifyRatingsJobId(input.productId);
  const existing = await queue.getJob(jobId);

  if (existing) {
    const state = await existing.getState();
    if (state === "delayed" || state === "waiting" || state === "prioritized") {
      // Already scheduled — it will recalculate from DB at run time.
      return;
    }
    if (state === "completed" || state === "failed") {
      await existing.remove();
    }
  }

  try {
    await queue.add(
      "sync",
      input,
      {
        jobId,
        delay: 2_000,
      },
    );
  } catch (error) {
    // Concurrent enqueue with the same jobId is fine — one sync is enough.
    if (
      error instanceof Error &&
      /Job .* already exists|already exists/i.test(error.message)
    ) {
      return;
    }
    throw error;
  }
}
