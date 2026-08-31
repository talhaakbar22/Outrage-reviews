import { getDb } from "@/lib/prisma";
import { enqueueWebhookEvent } from "@/lib/queue";
import { validateWebhookRequest } from "@/lib/shopify/webhooks";

type IngestOptions = {
  expectedTopics: string[];
};

type IngestResult =
  | { ok: true; status: 200; eventId?: string }
  | { ok: false; status: number; error: string };

export async function ingestWebhook(
  request: Request,
  { expectedTopics }: IngestOptions,
): Promise<IngestResult> {
  const rawBody = await request.text();
  const validation = await validateWebhookRequest(rawBody, request);

  if (!validation.valid) {
    return { ok: false, status: 401, error: "Invalid webhook signature" };
  }

  if (!expectedTopics.includes(validation.topic)) {
    return {
      ok: false,
      status: 400,
      error: `Unexpected topic ${validation.topic}`,
    };
  }

  const db = getDb();
  const shop = await db.orm.public.Shop.where({
    shopifyDomain: validation.domain,
  }).first();

  if (!shop) {
    return { ok: true, status: 200 };
  }

  let payload: ReturnType<typeof JSON.parse>;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON payload" };
  }

  const event = await db.orm.public.WebhookEvent.create({
    shopId: shop.id,
    topic: validation.topic,
    shopifyWebhookId: validation.webhookId,
    payload,
    status: "pending",
  });

  try {
    await enqueueWebhookEvent(event.id);
  } catch (error) {
    console.error("Failed to enqueue webhook event:", error);
  }

  return { ok: true, status: 200, eventId: event.id };
}

export function createWebhookRoute(expectedTopics: string[]) {
  return async function POST(request: Request) {
    const result = await ingestWebhook(request, { expectedTopics });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ ok: true }, { status: result.status });
  };
}
