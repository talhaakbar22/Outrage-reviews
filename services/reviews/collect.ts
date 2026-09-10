import { getDb, nowInstant, toIsoString } from "@/lib/prisma";
import { generateReviewToken } from "@/lib/review-token";
import {
  cancelReviewEmailJobs,
  enqueueReviewRequest,
} from "@/lib/queue";

export type CollectReviewRequestRow = {
  id: string;
  email: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  remindedAt: string | null;
  createdAt: string;
  customerName: string | null;
  productTitle: string | null;
  productImageUrl: string | null;
  orderNumber: string | null;
  fulfillmentStatus: string | null;
  deliveredAt: string | null;
};

function formatInstant(value: unknown) {
  return toIsoString(value as never);
}

export async function listCollectReviewRequests(
  shopId: string,
  input: { search?: string; limit?: number } = {},
) {
  const db = getDb();
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);
  const search = input.search?.trim().toLowerCase() ?? "";

  const rows = await db.orm.public.ReviewRequest.where({ shopId })
    .include("customer", (customer) =>
      customer.select("id", "firstName", "lastName", "email"),
    )
    .include("product", (product) =>
      product.select("id", "title", "imageUrl"),
    )
    .include("order", (order) =>
      order.select(
        "id",
        "shopifyOrderNumber",
        "fulfillmentStatus",
        "deliveredAt",
      ),
    )
    .orderBy((request) => request.createdAt.desc())
    .limit(limit * 3)
    .all();

  const mapped: CollectReviewRequestRow[] = rows.map((row) => {
    const customerName =
      [row.customer?.firstName, row.customer?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || null;

    return {
      id: row.id,
      email: row.email,
      status: row.status,
      scheduledAt: formatInstant(row.scheduledAt),
      sentAt: formatInstant(row.sentAt),
      remindedAt: formatInstant(row.remindedAt),
      createdAt: formatInstant(row.createdAt) ?? new Date().toISOString(),
      customerName,
      productTitle: row.product?.title ?? null,
      productImageUrl: row.product?.imageUrl ?? null,
      orderNumber: row.order?.shopifyOrderNumber ?? null,
      fulfillmentStatus: row.order?.fulfillmentStatus ?? null,
      deliveredAt: formatInstant(row.order?.deliveredAt),
    };
  });

  const filtered = search
    ? mapped.filter((row) => {
        const haystack = [
          row.email,
          row.customerName,
          row.productTitle,
          row.orderNumber,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      })
    : mapped;

  return filtered.slice(0, limit);
}

export async function sendCollectReviewRequestNow(input: {
  shopId: string;
  requestId: string;
}) {
  const db = getDb();
  const request = await db.orm.public.ReviewRequest.where({
    id: input.requestId,
    shopId: input.shopId,
  }).first();

  if (!request) {
    throw new Error("Review request not found");
  }

  if (
    request.status === "completed" ||
    request.status === "cancelled" ||
    request.status === "expired"
  ) {
    throw new Error(`Cannot send a ${request.status} request`);
  }

  if (request.sentAt) {
    throw new Error("This review request was already sent");
  }

  const { rawToken, tokenHash } = generateReviewToken();
  const now = nowInstant();

  await cancelReviewEmailJobs(request.id);
  await db.orm.public.ReviewRequest.where({ id: request.id }).update({
    tokenHash,
    status: "pending",
    scheduledAt: now,
  });

  await enqueueReviewRequest({
    requestId: request.id,
    rawToken,
    delayDays: 0,
  });

  return { ok: true as const };
}

export async function cancelCollectReviewRequest(input: {
  shopId: string;
  requestId: string;
}) {
  const db = getDb();
  const request = await db.orm.public.ReviewRequest.where({
    id: input.requestId,
    shopId: input.shopId,
  }).first();

  if (!request) {
    throw new Error("Review request not found");
  }

  if (request.status === "completed") {
    throw new Error("Completed requests cannot be cancelled");
  }

  await cancelReviewEmailJobs(request.id);
  await db.orm.public.ReviewRequest.where({ id: request.id }).update({
    status: "cancelled",
  });

  return { ok: true as const };
}
