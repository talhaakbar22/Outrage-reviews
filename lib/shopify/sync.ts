import type { Session } from "@shopify/shopify-api";
import { getDb, nowInstant } from "@/lib/prisma";
import {
  resolveProductId,
  upsertProduct,
} from "@/services/products/repository";
import {
  fetchOrdersPage,
  fetchProductsPage,
  mapShopifyProductStatus,
  parseProductRatings,
  shopifyGidToId,
} from "@/lib/shopify/products";

export type InitialSyncSummary = {
  productsSynced: number;
  ordersSynced: number;
  customersSynced: number;
  lineItemsMapped: number;
};

export class ShopifySyncService {
  constructor(private readonly session: Session) {}

  async runInitialSync(shopId: string): Promise<InitialSyncSummary> {
    const db = getDb();
    const job = await db.orm.public.SyncJob.create({
      shopId,
      type: "full_sync",
      status: "running",
      startedAt: new Date(),
      payload: { phase: "products" },
    });

    try {
      const productStats = await this.syncProducts(shopId);
      await db.orm.public.SyncJob.where({ id: job.id }).update({
        payload: { phase: "historical", ...productStats },
      });

      const historicalStats = await this.syncHistoricalData(shopId);
      const summary: InitialSyncSummary = {
        ...productStats,
        ...historicalStats,
      };

      await db.orm.public.SyncJob.where({ id: job.id }).update({
        status: "completed",
        completedAt: new Date(),
        payload: { phase: "complete", ...summary },
      });

      return summary;
    } catch (error) {
      await db.orm.public.SyncJob.where({ id: job.id }).update({
        status: "failed",
        completedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : "Unknown sync error",
      });
      throw error;
    }
  }

  async syncProducts(shopId: string) {
    let cursor: string | null = null;
    let hasNextPage = true;
    let productsSynced = 0;
    const syncedAt = nowInstant();

    while (hasNextPage) {
      const page = await fetchProductsPage(this.session, cursor);

      for (const product of page.products) {
        const ratings = parseProductRatings(product);

        await upsertProduct(shopId, {
          shopifyProductId: shopifyGidToId(product.id),
          title: product.title,
          handle: product.handle,
          imageUrl: product.featuredImage?.url ?? null,
          status: mapShopifyProductStatus(product.status),
          avgRating: ratings.avgRating,
          reviewCount: ratings.reviewCount,
          lastSyncedAt: syncedAt,
        });

        productsSynced += 1;
      }

      hasNextPage = page.pageInfo.hasNextPage;
      cursor = page.pageInfo.endCursor;
    }

    return { productsSynced };
  }

  async syncHistoricalData(shopId: string) {
    let cursor: string | null = null;
    let hasNextPage = true;
    let ordersSynced = 0;
    let customersSynced = 0;
    let lineItemsMapped = 0;

    while (hasNextPage) {
      const page = await fetchOrdersPage(this.session, cursor);

      for (const order of page.orders) {
        const shopifyOrderId = shopifyGidToId(order.id);
        let customerId: string | null = null;

        if (order.customer) {
          const shopifyCustomerId = shopifyGidToId(order.customer.id);
          const db = getDb();
          let existingCustomer = await db.orm.public.Customer.where({
            shopId,
            shopifyCustomerId,
          }).first();

          if (!existingCustomer) {
            existingCustomer = await db.orm.public.Customer.create({
              shopId,
              shopifyCustomerId,
              email: order.customer.email,
              firstName: order.customer.firstName,
              lastName: order.customer.lastName,
            });
            customersSynced += 1;
          }

          customerId = existingCustomer.id;
        }

        const db = getDb();
        const existingOrder = await db.orm.public.Order.where({
          shopId,
          shopifyOrderId,
        }).first();

        const orderPayload = {
          customerId,
          shopifyOrderNumber: order.name,
          email: order.email,
          fulfillmentStatus: order.displayFulfillmentStatus,
        };

        const orderRecord = existingOrder
          ? await db.orm.public.Order.where({ id: existingOrder.id }).update(
              orderPayload,
            )
          : await db.orm.public.Order.create({
              shopId,
              shopifyOrderId,
              ...orderPayload,
            });

        if (!orderRecord) {
          throw new Error(`Failed to persist order ${shopifyOrderId}`);
        }

        ordersSynced += 1;

        for (const lineItem of order.lineItems.nodes) {
          const shopifyLineItemId = shopifyGidToId(lineItem.id);
          const productId = await resolveProductId(
            shopId,
            lineItem.product ? shopifyGidToId(lineItem.product.id) : null,
          );

          if (productId) {
            lineItemsMapped += 1;
          }

          const existingLineItem = await db.orm.public.OrderLineItem.where({
            orderId: orderRecord.id,
            shopifyLineItemId,
          }).first();

          const lineItemPayload = {
            productId,
            title: lineItem.title,
            quantity: lineItem.quantity,
            sku: lineItem.sku,
          };

          if (existingLineItem) {
            await db.orm.public.OrderLineItem.where({
              id: existingLineItem.id,
            }).update(lineItemPayload);
          } else {
            await db.orm.public.OrderLineItem.create({
              orderId: orderRecord.id,
              shopifyLineItemId,
              ...lineItemPayload,
            });
          }
        }
      }

      hasNextPage = page.pageInfo.hasNextPage;
      cursor = page.pageInfo.endCursor;
    }

    return { ordersSynced, customersSynced, lineItemsMapped };
  }
}

export function createShopifySyncService(session: Session) {
  return new ShopifySyncService(session);
}
