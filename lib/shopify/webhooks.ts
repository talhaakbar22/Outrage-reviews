import type { Session } from "@shopify/shopify-api";
import { DeliveryMethod } from "@shopify/shopify-api";
import { getShopify } from "@/lib/shopify/client";
import { env } from "@/lib/env";
import {
  WEBHOOK_ROUTES,
  WEBHOOK_TOPICS,
  type WebhookTopic,
} from "@/services/webhooks/topics";

export const REGISTERED_WEBHOOK_TOPICS = Object.values(
  WEBHOOK_TOPICS,
) as WebhookTopic[];

let handlersRegistered = false;

function ensureWebhookHandlers() {
  if (handlersRegistered) {
    return;
  }

  getShopify().webhooks.addHandlers(
    Object.fromEntries(
      REGISTERED_WEBHOOK_TOPICS.map((topic) => [
        topic,
        [
          {
            deliveryMethod: DeliveryMethod.Http,
            callbackUrl: new URL(WEBHOOK_ROUTES[topic], env.appUrl()).toString(),
          },
        ],
      ]),
    ),
  );

  handlersRegistered = true;
}

export async function registerShopWebhooks(session: Session) {
  ensureWebhookHandlers();
  return getShopify().webhooks.register({ session });
}

export async function validateWebhookRequest(rawBody: string, request: Request) {
  return getShopify().webhooks.validate({
    rawBody,
    rawRequest: request,
  });
}

export async function fetchShopInfo(session: Session) {
  const { createGraphqlClient } = await import("@/lib/shopify/client");
  const client = createGraphqlClient(session);
  const response = await client.request<{
    shop: {
      id: string;
      name: string;
      email: string;
      currencyCode: string;
      ianaTimezone: string;
    };
  }>(`#graphql
    query ShopInfo {
      shop {
        id
        name
        email
        currencyCode
        ianaTimezone
      }
    }
  `);

  return response.data?.shop ?? null;
}
