import { createWebhookRoute } from "@/services/webhooks/ingest";
import { WEBHOOK_TOPICS } from "@/services/webhooks/topics";

export const POST = createWebhookRoute([WEBHOOK_TOPICS.ORDERS_PAID]);
