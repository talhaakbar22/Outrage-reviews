import { mapShopifyProductStatus, shopifyGidToId } from "@/lib/shopify/products";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function readString(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readNumber(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "number" ? value : null;
}

function shopifyId(value: unknown) {
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return shopifyGidToId(value);
  }
  return null;
}

export function parseOrderPaidPayload(payload: unknown) {
  const order = asRecord(payload);
  if (!order) {
    return null;
  }

  const shopifyOrderId = shopifyId(order.id);
  if (!shopifyOrderId) {
    return null;
  }

  const customer = asRecord(order.customer);
  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];

  return {
    shopifyOrderId,
    shopifyOrderNumber: readString(order, "name"),
    email: readString(order, "email") ?? readString(order, "contact_email"),
    fulfillmentStatus: readString(order, "fulfillment_status"),
    customer: customer
      ? {
          shopifyCustomerId: shopifyId(customer.id),
          email: readString(customer, "email"),
          firstName: readString(customer, "first_name"),
          lastName: readString(customer, "last_name"),
        }
      : null,
    lineItems: lineItems
      .map((item) => {
        const lineItem = asRecord(item);
        if (!lineItem) {
          return null;
        }

        const shopifyLineItemId = shopifyId(lineItem.id);
        if (!shopifyLineItemId) {
          return null;
        }

        return {
          shopifyLineItemId,
          shopifyProductId: shopifyId(lineItem.product_id),
          title: readString(lineItem, "title") ?? "Line item",
          quantity: readNumber(lineItem, "quantity") ?? 1,
          sku: readString(lineItem, "sku"),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
  };
}

export function parseFulfillmentPayload(payload: unknown) {
  const fulfillment = asRecord(payload);
  if (!fulfillment) {
    return null;
  }

  const shopifyOrderId = shopifyId(fulfillment.order_id);
  if (!shopifyOrderId) {
    return null;
  }

  return {
    shopifyOrderId,
    status: readString(fulfillment, "status"),
    fulfilledAt: readString(fulfillment, "created_at"),
    shipmentStatus: readString(fulfillment, "shipment_status"),
  };
}

export function parseFulfillmentEventPayload(payload: unknown) {
  const event = asRecord(payload);
  if (!event) {
    return null;
  }

  const shopifyOrderId = shopifyId(event.order_id);
  if (!shopifyOrderId) {
    return null;
  }

  return {
    shopifyOrderId,
    status: readString(event, "status"),
    happenedAt: readString(event, "happened_at"),
  };
}

export function parseProductUpdatePayload(payload: unknown) {
  const product = asRecord(payload);
  if (!product) {
    return null;
  }

  const shopifyProductId = shopifyId(product.id);
  if (!shopifyProductId) {
    return null;
  }

  const image = asRecord(product.image);

  return {
    shopifyProductId,
    title: readString(product, "title") ?? "Product",
    handle: readString(product, "handle"),
    status: mapShopifyProductStatus(readString(product, "status") ?? "active"),
    imageUrl: image ? readString(image, "src") : null,
  };
}

export function parseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
