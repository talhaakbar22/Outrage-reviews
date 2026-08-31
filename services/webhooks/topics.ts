export const WEBHOOK_TOPICS = {
  ORDERS_PAID: "ORDERS_PAID",
  FULFILLMENTS_CREATE: "FULFILLMENTS_CREATE",
  FULFILLMENT_EVENTS_CREATE: "FULFILLMENT_EVENTS_CREATE",
  PRODUCTS_UPDATE: "PRODUCTS_UPDATE",
  APP_UNINSTALLED: "APP_UNINSTALLED",
} as const;

export type WebhookTopic = (typeof WEBHOOK_TOPICS)[keyof typeof WEBHOOK_TOPICS];

export const WEBHOOK_ROUTES = {
  [WEBHOOK_TOPICS.ORDERS_PAID]: "/api/webhooks/orders-paid",
  [WEBHOOK_TOPICS.FULFILLMENTS_CREATE]: "/api/webhooks/fulfillments",
  [WEBHOOK_TOPICS.FULFILLMENT_EVENTS_CREATE]: "/api/webhooks/fulfillments",
  [WEBHOOK_TOPICS.PRODUCTS_UPDATE]: "/api/webhooks/products-update",
  [WEBHOOK_TOPICS.APP_UNINSTALLED]: "/api/webhooks/app-uninstalled",
} as const satisfies Record<WebhookTopic, string>;
