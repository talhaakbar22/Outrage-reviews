/**
 * Seed products into the local Test shop from storage/seed-products.json.
 * Keys by handle so Loox CSV matching works even when Shopify IDs collide.
 *
 *   yarn tsx --import dotenv/config scripts/seed-products-from-csv.ts
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDb, nowInstant } from "@/lib/prisma";

const SEED_PATH =
  process.env.PRODUCTS_SEED_JSON ??
  path.join(process.cwd(), "storage/seed-products.json");

const SHOP_DOMAIN =
  process.env.SEED_SHOP_DOMAIN ?? "test-lcoemihp.myshopify.com";

type SeedProduct = {
  handle: string;
  title: string;
  imageUrl: string | null;
  status: "active" | "archived" | "draft";
  shopifyProductId: string | null;
};

async function main() {
  const db = getDb();
  const shop = await db.orm.public.Shop.where({
    shopifyDomain: SHOP_DOMAIN,
  }).first();

  if (!shop) {
    throw new Error(`Shop not found: ${SHOP_DOMAIN}`);
  }

  const raw = await readFile(SEED_PATH, "utf8");
  const products = JSON.parse(raw) as SeedProduct[];
  const now = nowInstant();
  const usedShopifyIds = new Set<string>();

  // Reserve IDs already in DB for other handles.
  const existing = await db.orm.public.Product.where({ shopId: shop.id }).all();
  for (const product of existing) {
    usedShopifyIds.add(product.shopifyProductId);
  }

  let created = 0;
  let updated = 0;

  for (const product of products) {
    const handle = product.handle.trim();
    if (!handle) continue;

    let shopifyProductId = product.shopifyProductId?.trim() || "";
    const byHandle = await db.orm.public.Product.where({
      shopId: shop.id,
      handle,
    }).first();

    if (byHandle) {
      // Keep existing Shopify ID if present; otherwise assign a free one.
      const nextId =
        byHandle.shopifyProductId ||
        (shopifyProductId && !usedShopifyIds.has(shopifyProductId)
          ? shopifyProductId
          : `csv-${handle}`.slice(0, 64));

      await db.orm.public.Product.where({ id: byHandle.id }).update({
        title: product.title || handle,
        imageUrl: product.imageUrl,
        status: product.status || "active",
        shopifyProductId: nextId,
        lastSyncedAt: now,
      });
      usedShopifyIds.add(nextId);
      updated += 1;
      continue;
    }

    if (!shopifyProductId || usedShopifyIds.has(shopifyProductId)) {
      shopifyProductId = `csv-${handle}`.slice(0, 64);
    }

    // If synthetic also collides (re-run), make it unique.
    if (usedShopifyIds.has(shopifyProductId)) {
      shopifyProductId = `csv-${handle}-${created + updated}`.slice(0, 64);
    }

    await db.orm.public.Product.create({
      shopId: shop.id,
      shopifyProductId,
      title: product.title || handle,
      handle,
      imageUrl: product.imageUrl,
      status: product.status || "active",
      lastSyncedAt: now,
      avgRating: null,
      reviewCount: 0,
    });
    usedShopifyIds.add(shopifyProductId);
    created += 1;
  }

  const total = await db.orm.public.Product.where({ shopId: shop.id }).all();
  const withLooxHandles = products.filter((p) =>
    total.some((row) => row.handle === p.handle),
  ).length;

  console.log(
    JSON.stringify(
      {
        shop: shop.shopifyDomain,
        created,
        updated,
        productsInShop: total.length,
        seedHandlesPresent: withLooxHandles,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
