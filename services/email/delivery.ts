import { getDb, isBefore, nowInstant, toIsoString } from "@/lib/prisma";
import { buildReviewRequestUrl } from "@/lib/review-token";
import {
  enqueueReviewReminder,
  cancelReviewEmailJobs,
  enqueuePhotoReminder,
  DEFAULT_PHOTO_REMINDER_DELAY_DAYS,
} from "@/lib/queue";
import {
  sendMerchantReplyEmailMessage,
  sendReviewEmail,
} from "@/services/email/send";
import type {
  ConversationMessage,
  ReviewEmailKind,
} from "@/services/email/types";

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

function formatConversationDate(value: unknown) {
  const iso = toIsoString(value as never);
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function productStorefrontUrl(input: {
  shopifyDomain: string;
  handle: string | null;
}) {
  if (!input.handle) return null;
  return `https://${input.shopifyDomain}/products/${input.handle}`;
}

export async function sendMerchantReplyEmail(input: {
  shopId: string;
  reviewId: string;
}) {
  const db = getDb();
  const [settings, shop, review] = await Promise.all([
    db.orm.public.ShopSettings.where({ shopId: input.shopId }).first(),
    db.orm.public.Shop.where({ id: input.shopId }).first(),
    db.orm.public.Review.where({
      id: input.reviewId,
      shopId: input.shopId,
    })
      .include("product", (product) =>
        product.select("id", "title", "handle", "imageUrl"),
      )
      .include("replies", (replies) =>
        replies
          .select("id", "body", "authorName", "publishedAt")
          .orderBy((item) => item.publishedAt.asc()),
      )
      .first(),
  ]);

  if (!settings?.emailEnabled) {
    return { sent: false as const, reason: "email_disabled" };
  }

  if (!shop || !review) {
    return { sent: false as const, reason: "missing_review" };
  }

  const to = review.reviewerEmail?.trim() || null;
  if (!to) {
    return { sent: false as const, reason: "missing_reviewer_email" };
  }

  const shopName = shop.name ?? shop.shopifyDomain;
  const product = review.product;
  const productTitle = product?.title ?? "your purchase";
  const productUrl = product
    ? productStorefrontUrl({
        shopifyDomain: shop.shopifyDomain,
        handle: product.handle,
      })
    : null;

  const conversation: ConversationMessage[] = [
    {
      role: "customer",
      authorName: review.reviewerName?.trim() || "You",
      body:
        [review.title?.trim(), review.body?.trim()].filter(Boolean).join("\n\n") ||
        "Left a star rating.",
      rating: review.rating,
      sentAt: formatConversationDate(review.publishedAt ?? review.createdAt),
    },
  ];

  const replies = Array.isArray(review.replies) ? review.replies : [];
  for (const reply of replies) {
    const body = reply.body?.trim();
    if (!body) continue;
    conversation.push({
      role: "store",
      authorName: reply.authorName?.trim() || shopName,
      body,
      sentAt: formatConversationDate(reply.publishedAt),
    });
  }

  if (conversation.length < 2) {
    return { sent: false as const, reason: "missing_store_reply" };
  }

  await sendMerchantReplyEmailMessage({
    to,
    shopName,
    shopDomain: shop.shopifyDomain,
    productTitle,
    productUrl,
    productImageUrl: product?.imageUrl ?? null,
    customerName: review.reviewerName,
    conversation,
  });

  return { sent: true as const };
}

export async function sendThankYouEmail(input: {
  shopId: string;
  reviewId: string;
}) {
  const db = getDb();
  const [settings, shop, review] = await Promise.all([
    db.orm.public.ShopSettings.where({ shopId: input.shopId }).first(),
    db.orm.public.Shop.where({ id: input.shopId }).first(),
    db.orm.public.Review.where({
      id: input.reviewId,
      shopId: input.shopId,
    })
      .include("product", (product) =>
        product.select("id", "title", "handle", "imageUrl"),
      )
      .first(),
  ]);

  if (!settings?.emailEnabled) {
    return { sent: false as const, reason: "email_disabled" };
  }

  if (!shop || !review) {
    return { sent: false as const, reason: "missing_review" };
  }

  const to = review.reviewerEmail?.trim() || null;
  if (!to) {
    return { sent: false as const, reason: "missing_reviewer_email" };
  }

  const product = review.product;
  const productUrl = product
    ? productStorefrontUrl({
        shopifyDomain: shop.shopifyDomain,
        handle: product.handle,
      })
    : null;

  if (!productUrl) {
    console.warn(
      `[email] thank-you for ${input.reviewId}: product has no public handle; skipping storefront CTA`,
    );
  }

  await sendReviewEmail({
    to,
    shopName: shop.name ?? shop.shopifyDomain,
    productTitle: product?.title ?? "your purchase",
    customerName: review.reviewerName,
    // Thank-you CTAs must use the public storefront product URL only.
    reviewUrl: productUrl ?? `https://${shop.shopifyDomain}`,
    productUrl,
    productImageUrl: product?.imageUrl ?? null,
    kind: "thank_you" satisfies ReviewEmailKind,
  });

  return { sent: true as const };
}

export async function sendPhotoReminderEmail(input: {
  shopId: string;
  reviewId: string;
}) {
  const db = getDb();
  const [settings, shop, review, existingMedia] = await Promise.all([
    db.orm.public.ShopSettings.where({ shopId: input.shopId }).first(),
    db.orm.public.Shop.where({ id: input.shopId }).first(),
    db.orm.public.Review.where({
      id: input.reviewId,
      shopId: input.shopId,
    })
      .include("product", (product) =>
        product.select("id", "title", "handle"),
      )
      .first(),
    db.orm.public.ReviewMedia.where({ reviewId: input.reviewId })
      .select("id")
      .first(),
  ]);

  if (!settings?.emailEnabled) {
    return { sent: false as const, reason: "email_disabled" };
  }

  if (!shop || !review) {
    return { sent: false as const, reason: "missing_review" };
  }

  if (existingMedia) {
    return { sent: false as const, reason: "already_has_media" };
  }

  const to = review.reviewerEmail?.trim() || null;
  if (!to) {
    return { sent: false as const, reason: "missing_reviewer_email" };
  }

  const product = review.product;
  const productUrl = product
    ? productStorefrontUrl({
        shopifyDomain: shop.shopifyDomain,
        handle: product.handle,
      })
    : null;

  await sendReviewEmail({
    to,
    shopName: shop.name ?? shop.shopifyDomain,
    productTitle: product?.title ?? "your purchase",
    customerName: review.reviewerName,
    reviewUrl: productUrl ?? `https://${shop.shopifyDomain}`,
    productUrl,
    kind: "photo_reminder" satisfies ReviewEmailKind,
  });

  return { sent: true as const };
}

/**
 * After a customer submits a review: thank them, and if they left text only,
 * schedule a photo/video reminder a few days later.
 */
export async function schedulePostSubmissionEmails(input: {
  shopId: string;
  reviewId: string;
  hasMedia: boolean;
}) {
  const thankYou = await sendThankYouEmail({
    shopId: input.shopId,
    reviewId: input.reviewId,
  });

  if (!input.hasMedia) {
    await enqueuePhotoReminder({
      shopId: input.shopId,
      reviewId: input.reviewId,
      delayDays: DEFAULT_PHOTO_REMINDER_DELAY_DAYS,
    });
  }

  return { thankYou };
}
