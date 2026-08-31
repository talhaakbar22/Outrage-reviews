import { createWebhookRoute } from "@/services/webhooks/ingest";
import { WEBHOOK_TOPICS } from "@/services/webhooks/topics";

export const POST = createWebhookRoute([
  WEBHOOK_TOPICS.FULFILLMENTS_CREATE,
  WEBHOOK_TOPICS.FULFILLMENT_EVENTS_CREATE,
]);
