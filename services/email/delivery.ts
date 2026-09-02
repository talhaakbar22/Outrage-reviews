import { getDb, isBefore, nowInstant } from "@/lib/prisma";
import { buildReviewRequestUrl } from "@/lib/review-token";
import {
  enqueueReviewReminder,
  cancelReviewEmailJobs,
} from "@/lib/queue";
import { sendReviewEmail } from "@/services/email/send";
import type { ReviewEmailKind } from "@/services/email/types";

async function loadEmailContext(requestId: string, rawToken: string) {
  const db = getDb();
  const request = await db.orm.public.ReviewRequest.where({ id: requestId }).first();

  if (!request) {
    return { skip: true as const, reason: "missing_request" };
  }

  if (
    request.status === "completed" ||
    request.status === "cancelled" ||
    request.status === "expired"
  ) {
    return { skip: true as const, reason: `status_${request.status}` };
  }

  const now = nowInstant();
  if (request.expiresAt && isBefore(request.expiresAt, now)) {
    await db.orm.public.ReviewRequest.where({ id: request.id }).update({
      status: "expired",
    });
    return { skip: true as const, reason: "expired" };
  }

  if (request.orderLineItemId) {
    const existingReview = await db.orm.public.Review.where({
      orderLineItemId: request.orderLineItemId,
    }).first();
    if (existingReview) {
      await db.orm.public.ReviewRequest.where({ id: request.id }).update({
        status: "completed",
        completedAt: now,
      });
      await cancelReviewEmailJobs(request.id);
      return { skip: true as const, reason: "already_reviewed" };
    }
  }

  const [settings, shop, product, customer] = await Promise.all([
    db.orm.public.ShopSettings.where({ shopId: request.shopId }).first(),
    db.orm.public.Shop.where({ id: request.shopId }).first(),
    request.productId
      ? db.orm.public.Product.where({ id: request.productId }).first()
      : Promise.resolve(null),
    request.customerId
      ? db.orm.public.Customer.where({ id: request.customerId }).first()
      : Promise.resolve(null),
  ]);

  if (!settings?.emailEnabled) {
    return { skip: true as const, reason: "email_disabled" };
  }

  if (!shop || !product) {
    return { skip: true as const, reason: "missing_shop_or_product" };
  }

  const customerName =
    [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || null;

  return {
    skip: false as const,
    request,
    settings,
    shop,
    product,
    customerName,
    reviewUrl: buildReviewRequestUrl(rawToken),
  };
}

export async function sendReviewRequestEmail(input: {
  requestId: string;
  rawToken: string;
}) {
  const context = await loadEmailContext(input.requestId, input.rawToken);
  if (context.skip) {
    console.log(
      `Skipping review request email for ${input.requestId}: ${context.reason}`,
    );
    return { sent: false as const, reason: context.reason };
  }

  if (context.request.sentAt) {
    console.log(`Review request email already sent for ${input.requestId}`);
    return { sent: false as const, reason: "already_sent" };
  }

  await sendReviewEmail({
    to: context.request.email,
    shopName: context.shop.name ?? context.shop.shopifyDomain,
    productTitle: context.product.title,
    customerName: context.customerName,
    reviewUrl: context.reviewUrl,
    kind: "request" satisfies ReviewEmailKind,
  });

  const now = nowInstant();
  await getDb().orm.public.ReviewRequest.where({ id: context.request.id }).update({
    status: "sent",
    sentAt: now,
  });

  await enqueueReviewReminder({
    requestId: context.request.id,
    rawToken: input.rawToken,
    delayDays: context.settings.reminderDelayDays ?? 7,
  });

  return { sent: true as const };
}

export async function sendReviewReminderEmail(input: {
  requestId: string;
  rawToken: string;
}) {
  const context = await loadEmailContext(input.requestId, input.rawToken);
  if (context.skip) {
    console.log(
      `Skipping review reminder email for ${input.requestId}: ${context.reason}`,
    );
    return { sent: false as const, reason: context.reason };
  }

  if (!context.request.sentAt) {
    console.log(
      `Skipping reminder for ${input.requestId}: initial request not sent yet`,
    );
    return { sent: false as const, reason: "request_not_sent" };
  }

  if (context.request.remindedAt) {
    console.log(`Reminder already sent for ${input.requestId}`);
    return { sent: false as const, reason: "already_reminded" };
  }

  if (context.request.status === "completed") {
    return { sent: false as const, reason: "completed" };
  }

  await sendReviewEmail({
    to: context.request.email,
    shopName: context.shop.name ?? context.shop.shopifyDomain,
    productTitle: context.product.title,
    customerName: context.customerName,
    reviewUrl: context.reviewUrl,
    kind: "reminder",
  });

  await getDb().orm.public.ReviewRequest.where({ id: context.request.id }).update({
    remindedAt: nowInstant(),
  });

  return { sent: true as const };
}
