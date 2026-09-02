import {
  addDays,
  getDb,
  isBefore,
  nowInstant,
} from "@/lib/prisma";
import {
  generateReviewToken,
  hashReviewToken,
  isValidReviewTokenFormat,
} from "@/lib/review-token";

export type ReviewRequestContext = {
  request: {
    id: string;
    status: string;
    email: string;
    expiresAt: Date | null;
    scheduledAt: Date | null;
    completedAt: Date | null;
  };
  product: {
    id: string;
    title: string;
    imageUrl: string | null;
    handle: string | null;
  };
  shop: {
    id: string;
    name: string | null;
    shopifyDomain: string;
  };
  customerName: string | null;
};

export class ReviewRequestError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid_token"
      | "not_found"
      | "expired"
      | "not_ready"
      | "already_completed"
      | "duplicate_review",
  ) {
    super(message);
    this.name = "ReviewRequestError";
  }
}

function addDaysFromNow(days: number) {
  return addDays(nowInstant(), days);
}

export async function createReviewRequestForLineItem(input: {
  shopId: string;
  orderId: string;
  orderLineItemId: string;
  productId: string;
  customerId: string | null;
  email: string;
  requestDelayDays: number;
  expiryDays?: number;
}) {
  const db = getDb();

  const existingRequest = await db.orm.public.ReviewRequest.where({
    orderLineItemId: input.orderLineItemId,
  }).first();

  if (existingRequest) {
    return null;
  }

  const existingReview = await db.orm.public.Review.where({
    orderLineItemId: input.orderLineItemId,
  }).first();

  if (existingReview) {
    return null;
  }

  const { rawToken, tokenHash } = generateReviewToken();

  const request = await db.orm.public.ReviewRequest.create({
    shopId: input.shopId,
    orderId: input.orderId,
    orderLineItemId: input.orderLineItemId,
    productId: input.productId,
    customerId: input.customerId,
    email: input.email,
    tokenHash,
    status: "pending",
    scheduledAt: addDaysFromNow(input.requestDelayDays),
    expiresAt: addDaysFromNow(input.expiryDays ?? 90),
  });

  if (!request) {
    return null;
  }

  return { request, rawToken };
}

export async function findReviewRequestByRawToken(rawToken: string) {
  if (!isValidReviewTokenFormat(rawToken)) {
    return null;
  }

  const db = getDb();
  const tokenHash = hashReviewToken(rawToken);

  return db.orm.public.ReviewRequest.where({ tokenHash }).first();
}

export async function loadReviewRequestContext(
  rawToken: string,
): Promise<ReviewRequestContext> {
  const request = await findReviewRequestByRawToken(rawToken);

  if (!request) {
    throw new ReviewRequestError("This review link is invalid.", "not_found");
  }

  if (request.status === "completed") {
    throw new ReviewRequestError(
      "You already submitted a review for this product.",
      "already_completed",
    );
  }

  if (request.status === "cancelled" || request.status === "expired") {
    throw new ReviewRequestError("This review link has expired.", "expired");
  }

  const now = nowInstant();
  if (request.expiresAt && isBefore(request.expiresAt, now)) {
    await getDb().orm.public.ReviewRequest.where({ id: request.id }).update({
      status: "expired",
    });
    throw new ReviewRequestError("This review link has expired.", "expired");
  }

  if (
    !request.sentAt &&
    request.scheduledAt &&
    isBefore(now, request.scheduledAt)
  ) {
    throw new ReviewRequestError(
      "This review request is not ready yet. Please check your email again later.",
      "not_ready",
    );
  }

  if (!request.productId) {
    throw new ReviewRequestError(
      "We could not find the product for this review request.",
      "not_found",
    );
  }

  const db = getDb();
  const [product, shop, customer] = await Promise.all([
    db.orm.public.Product.where({ id: request.productId }).first(),
    db.orm.public.Shop.where({ id: request.shopId }).first(),
    request.customerId
      ? db.orm.public.Customer.where({ id: request.customerId }).first()
      : Promise.resolve(null),
  ]);

  if (!product || !shop) {
    throw new ReviewRequestError(
      "We could not load the product for this review request.",
      "not_found",
    );
  }

  if (request.orderLineItemId) {
    const duplicateReview = await db.orm.public.Review.where({
      orderLineItemId: request.orderLineItemId,
    }).first();

    if (duplicateReview) {
      throw new ReviewRequestError(
        "A review has already been submitted for this purchase.",
        "duplicate_review",
      );
    }
  }

  if (!request.openedAt) {
    await db.orm.public.ReviewRequest.where({ id: request.id }).update({
      openedAt: now,
      status: request.status === "pending" ? "opened" : request.status,
    });
  }

  const customerName =
    [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || null;

  return {
    request: {
      id: request.id,
      status: request.status,
      email: request.email,
      expiresAt: request.expiresAt,
      scheduledAt: request.scheduledAt,
      completedAt: request.completedAt,
    },
    product: {
      id: product.id,
      title: product.title,
      imageUrl: product.imageUrl,
      handle: product.handle,
    },
    shop: {
      id: shop.id,
      name: shop.name,
      shopifyDomain: shop.shopifyDomain,
    },
    customerName,
  };
}

export async function markReviewRequestCompleted(requestId: string) {
  const db = getDb();
  await db.orm.public.ReviewRequest.where({ id: requestId }).update({
    status: "completed",
    completedAt: nowInstant(),
  });

  const { cancelReviewEmailJobs } = await import("@/lib/queue");
  await cancelReviewEmailJobs(requestId);
}
