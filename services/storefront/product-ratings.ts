import { getDb } from "@/lib/prisma";
import { getShopByDomain } from "@/services/storefront/reviews";

export type ProductCardRating = {
  shopifyProductId: string;
  handle: string | null;
  avgRating: number;
  reviewCount: number;
};

function normalizeIds(values: string[]) {
  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value.replace(/\D/g, "") || value)
        .filter(Boolean),
    ),
  ].slice(0, 100);
}

function normalizeHandles(values: string[]) {
  return [
    ...new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
        .map((value) => value.replace(/^\/products\//, "").split(/[?#]/)[0]!)
        .filter(Boolean),
    ),
  ].slice(0, 100);
}

export async function listProductCardRatings(input: {
  shopDomain: string;
  productIds?: string[];
  handles?: string[];
}): Promise<ProductCardRating[]> {
  const shop = await getShopByDomain(input.shopDomain);
  if (!shop || shop.uninstalledAt) {
    return [];
  }

  const db = getDb();
  const productIds = normalizeIds(input.productIds ?? []);
  const handles = normalizeHandles(input.handles ?? []);

  if (productIds.length === 0 && handles.length === 0) {
    return [];
  }

  let products =
    productIds.length > 0
      ? await db.orm.public.Product.where({ shopId: shop.id })
          .where((row) => row.shopifyProductId.in(productIds))
          .all()
      : [];

  if (handles.length > 0) {
    const byHandle = await db.orm.public.Product.where({ shopId: shop.id })
      .where((row) => row.handle.in(handles))
      .all();
    const seen = new Set(products.map((row) => row.id));
    for (const row of byHandle) {
      if (!seen.has(row.id)) {
        products.push(row);
        seen.add(row.id);
      }
    }
  }

  return products
    .filter((row) => (row.reviewCount ?? 0) > 0 && row.avgRating != null)
    .map((row) => ({
      shopifyProductId: row.shopifyProductId,
      handle: row.handle,
      avgRating: Number(row.avgRating ?? 0),
      reviewCount: Number(row.reviewCount ?? 0),
    }));
}
