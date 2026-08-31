import { getDb } from "@/lib/prisma";
import { buildReviewRequestUrl } from "@/lib/review-token";
import { enqueueReviewRequest } from "@/lib/queue";
import { createReviewRequestForLineItem } from "@/services/reviews/request";

export type ScheduledReviewRequest = {
  requestId: string;
  reviewUrl: string;
  email: string;
  productTitle: string;
  delayDays: number;
};

export async function scheduleReviewRequestsForOrder(shopId: string, orderId: string) {
  const db = getDb();
  const [order, settings, lineItems] = await Promise.all([
    db.orm.public.Order.where({ id: orderId }).first(),
    db.orm.public.ShopSettings.where({ shopId }).first(),
    db.orm.public.OrderLineItem.where({ orderId }).all(),
  ]);

  if (!order?.email) {
    return [] as ScheduledReviewRequest[];
  }

  if (settings && settings.emailEnabled === false) {
    return [] as ScheduledReviewRequest[];
  }

  const delayDays = settings?.requestDelayDays ?? 7;
  const scheduled: ScheduledReviewRequest[] = [];

  for (const lineItem of lineItems) {
    if (!lineItem.productId) {
      continue;
    }

    const product = await db.orm.public.Product.where({ id: lineItem.productId }).first();
    if (!product) {
      continue;
    }

    const created = await createReviewRequestForLineItem({
      shopId,
      orderId: order.id,
      orderLineItemId: lineItem.id,
      productId: lineItem.productId,
      customerId: order.customerId,
      email: order.email,
      requestDelayDays: delayDays,
    });

    if (!created) {
      continue;
    }

    await enqueueReviewRequest({
      requestId: created.request.id,
      rawToken: created.rawToken,
      delayDays,
    });

    scheduled.push({
      requestId: created.request.id,
      reviewUrl: buildReviewRequestUrl(created.rawToken),
      email: order.email,
      productTitle: product.title,
      delayDays,
    });
  }

  return scheduled;
}
