import { getDb, nowInstant, toInstant } from "@/lib/prisma";
import { upsertProduct } from "@/services/products/repository";
import { markShopUninstalled } from "@/services/shop/service";
import { WEBHOOK_TOPICS } from "@/services/webhooks/topics";
import { parseDate,
  parseFulfillmentEventPayload,
  parseFulfillmentPayload,
  parseOrderPaidPayload,
  parseProductUpdatePayload,
} from "@/services/webhooks/payloads";
import { scheduleReviewRequestsForOrder } from "@/services/reviews/scheduler";

export async function processWebhookEvent(eventId: string) {
  const db = getDb();
  const event = await db.orm.public.WebhookEvent.where({ id: eventId }).first();

  if (!event) {
    throw new Error(`Webhook event ${eventId} not found`);
  }

  if (event.status === "processed") {
    return;
  }

  try {
    switch (event.topic) {
      case WEBHOOK_TOPICS.ORDERS_PAID:
        await handleOrderPaid(event.shopId, event.payload);
        break;
      case WEBHOOK_TOPICS.FULFILLMENTS_CREATE:
        await handleFulfillmentCreated(event.shopId, event.payload);
        break;
      case WEBHOOK_TOPICS.FULFILLMENT_EVENTS_CREATE:
        await handleFulfillmentEvent(event.shopId, event.payload);
        break;
      case WEBHOOK_TOPICS.PRODUCTS_UPDATE:
        await handleProductUpdate(event.shopId, event.payload);
        break;
      case WEBHOOK_TOPICS.APP_UNINSTALLED:
        await handleAppUninstalled(event.shopId);
        break;
      default:
        throw new Error(`Unsupported webhook topic: ${event.topic}`);
    }

    await db.orm.public.WebhookEvent.where({ id: event.id }).update({
      status: "processed",
      processedAt: nowInstant(),
      errorMessage: null,
    });
  } catch (error) {
    await db.orm.public.WebhookEvent.where({ id: event.id }).update({
      status: "failed",
      processedAt: nowInstant(),
      errorMessage:
        error instanceof Error ? error.message : "Webhook processing failed",
    });
    throw error;
  }
}

async function handleOrderPaid(shopId: string, payload: unknown) {
  const order = parseOrderPaidPayload(payload);
  if (!order) {
    throw new Error("Invalid ORDERS_PAID payload");
  }

  const db = getDb();
  let customerId: string | null = null;

  if (order.customer?.shopifyCustomerId) {
    const existingCustomer = await db.orm.public.Customer.where({
      shopId,
      shopifyCustomerId: order.customer.shopifyCustomerId,
    }).first();

    customerId = existingCustomer
      ? existingCustomer.id
      : (
          await db.orm.public.Customer.create({
            shopId,
            shopifyCustomerId: order.customer.shopifyCustomerId,
            email: order.customer.email,
            firstName: order.customer.firstName,
            lastName: order.customer.lastName,
          })
        ).id;
  }

  const existingOrder = await db.orm.public.Order.where({
    shopId,
    shopifyOrderId: order.shopifyOrderId,
  }).first();

  const orderPayload = {
    customerId,
    shopifyOrderNumber: order.shopifyOrderNumber,
    email: order.email,
    fulfillmentStatus: order.fulfillmentStatus,
  };

  const orderRecord = existingOrder
    ? await db.orm.public.Order.where({ id: existingOrder.id }).update(orderPayload)
    : await db.orm.public.Order.create({
        shopId,
        shopifyOrderId: order.shopifyOrderId,
        ...orderPayload,
      });

  if (!orderRecord) {
    throw new Error(`Failed to persist order ${order.shopifyOrderId}`);
  }

  for (const lineItem of order.lineItems) {
    let productId: string | null = null;

    if (lineItem.shopifyProductId) {
      const product = await db.orm.public.Product.where({
        shopId,
        shopifyProductId: lineItem.shopifyProductId,
      }).first();
      productId = product?.id ?? null;
    }

    const existingLineItem = await db.orm.public.OrderLineItem.where({
      orderId: orderRecord.id,
      shopifyLineItemId: lineItem.shopifyLineItemId,
    }).first();

    const lineItemPayload = {
      productId,
      title: lineItem.title,
      quantity: lineItem.quantity,
      sku: lineItem.sku,
    };

    if (existingLineItem) {
      await db.orm.public.OrderLineItem.where({ id: existingLineItem.id }).update(
        lineItemPayload,
      );
    } else {
      await db.orm.public.OrderLineItem.create({
        orderId: orderRecord.id,
        shopifyLineItemId: lineItem.shopifyLineItemId,
        ...lineItemPayload,
      });
    }
  }
}

async function handleFulfillmentCreated(shopId: string, payload: unknown) {
  const fulfillment = parseFulfillmentPayload(payload);
  if (!fulfillment) {
    throw new Error("Invalid FULFILLMENTS_CREATE payload");
  }

  const db = getDb();
  const order = await db.orm.public.Order.where({
    shopId,
    shopifyOrderId: fulfillment.shopifyOrderId,
  }).first();

  if (!order) {
    return;
  }

  await db.orm.public.Order.where({ id: order.id }).update({
    fulfillmentStatus: fulfillment.status ?? order.fulfillmentStatus,
    fulfilledAt: parseDate(fulfillment.fulfilledAt) ?? order.fulfilledAt,
  });
}

async function handleFulfillmentEvent(shopId: string, payload: unknown) {
  const fulfillmentEvent = parseFulfillmentEventPayload(payload);
  if (!fulfillmentEvent) {
    throw new Error("Invalid FULFILLMENT_EVENTS_CREATE payload");
  }

  if (fulfillmentEvent.status?.toLowerCase() !== "delivered") {
    return;
  }

  const db = getDb();
  const order = await db.orm.public.Order.where({
    shopId,
    shopifyOrderId: fulfillmentEvent.shopifyOrderId,
  }).first();

  if (!order) {
    return;
  }

  await db.orm.public.Order.where({ id: order.id }).update({
    deliveredAt: toInstant(parseDate(fulfillmentEvent.happenedAt) ?? new Date()),
    fulfillmentStatus: "delivered",
  });

  await scheduleReviewRequestsForOrder(shopId, order.id);
}

async function handleProductUpdate(shopId: string, payload: unknown) {
  const product = parseProductUpdatePayload(payload);
  if (!product) {
    throw new Error("Invalid PRODUCTS_UPDATE payload");
  }

  await upsertProduct(shopId, {
    shopifyProductId: product.shopifyProductId,
    title: product.title,
    handle: product.handle,
    imageUrl: product.imageUrl,
    status: product.status,
    lastSyncedAt: nowInstant(),
  });
}

async function handleAppUninstalled(shopId: string) {
  const db = getDb();
  const shop = await db.orm.public.Shop.where({ id: shopId }).first();

  if (!shop) {
    return;
  }

  await markShopUninstalled(shop.shopifyDomain);
}
