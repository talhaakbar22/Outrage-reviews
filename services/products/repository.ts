import { getDb, toInstant, type DbInstant } from "@/lib/prisma";

export type ProductUpsertInput = {
  shopifyProductId: string;
  title: string;
  handle: string | null;
  imageUrl: string | null;
  status: "active" | "archived" | "draft";
  lastSyncedAt: Date | DbInstant;
  avgRating?: number | null;
  reviewCount?: number;
};

export async function upsertProduct(shopId: string, input: ProductUpsertInput) {
  const db = getDb();
  const existing = await db.orm.public.Product.where({
    shopId,
    shopifyProductId: input.shopifyProductId,
  }).first();

  const payload = {
    title: input.title,
    handle: input.handle,
    imageUrl: input.imageUrl,
    status: input.status,
    lastSyncedAt: toInstant(input.lastSyncedAt),
    avgRating:
      input.avgRating !== undefined
        ? input.avgRating
        : (existing?.avgRating ?? null),
    reviewCount:
      input.reviewCount !== undefined
        ? input.reviewCount
        : (existing?.reviewCount ?? 0),
  };

  if (existing) {
    return db.orm.public.Product.where({ id: existing.id }).update(payload);
  }

  return db.orm.public.Product.create({
    shopId,
    shopifyProductId: input.shopifyProductId,
    ...payload,
    avgRating: input.avgRating ?? null,
    reviewCount: input.reviewCount ?? 0,
  });
}

export async function resolveProductId(
  shopId: string,
  shopifyProductId: string | null,
) {
  if (!shopifyProductId) {
    return null;
  }

  const db = getDb();
  const product = await db.orm.public.Product.where({
    shopId,
    shopifyProductId,
  }).first();

  return product?.id ?? null;
}

export async function resolveProductByHandle(shopId: string, handle: string | null) {
  if (!handle) {
    return null;
  }

  const db = getDb();
  const product = await db.orm.public.Product.where({
    shopId,
    handle,
  }).first();

  return product?.id ?? null;
}

export async function resolveProductForLooxRow(
  shopId: string,
  input: { productHandle: string | null; shopifyProductId: string | null },
) {
  const byHandle = await resolveProductByHandle(shopId, input.productHandle);
  if (byHandle) {
    return byHandle;
  }

  return resolveProductId(shopId, input.shopifyProductId);
}

export async function getProductById(productId: string) {
  const db = getDb();
  return db.orm.public.Product.where({ id: productId }).first();
}
