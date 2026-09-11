/**
 * Upsert products using exact Shopify IDs from Loox CSV.
 *
 *   yarn tsx --import dotenv/config scripts/seed-loox-products-by-id.ts
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDb, nowInstant } from "@/lib/prisma";

const SEED_PATH =
  process.env.PRODUCTS_SEED_JSON ??
  path.join(process.cwd(), "storage/seed-products-by-id.json");

const SHOP_DOMAIN =
  process.env.SEED_SHOP_DOMAIN ?? "test-lcoemihp.myshopify.com";

type SeedProduct = {
  shopifyProductId: string;
  handle: string;
  title: string;
  imageUrl: string | null;
  status: "active" | "archived" | "draft";
};

async function main() {
  const db = getDb();
  const shop = await db.orm.public.Shop.where({
    shopifyDomain: SHOP_DOMAIN,
  }).first();
  if (!shop) throw new Error(`Shop not found: ${SHOP_DOMAIN}`);

  const products = JSON.parse(await readFile(SEED_PATH, "utf8")) as SeedProduct[];
  const now = nowInstant();
  let created = 0;
  let updated = 0;

  for (const product of products) {
    const shopifyProductId = product.shopifyProductId.trim();
    const handle = product.handle.trim();
    if (!shopifyProductId || !handle) continue;

    const byId = await db.orm.public.Product.where({
      shopId: shop.id,
      shopifyProductId,
    }).first();

    if (byId) {
      await db.orm.public.Product.where({ id: byId.id }).update({
        handle,
        title: product.title || handle,
        imageUrl: product.imageUrl,
        status: product.status || "active",
        lastSyncedAt: now,
      });
      updated += 1;
      continue;
    }

    // If this handle exists under a different ID, update that row to the real ID
    // only when the real ID is free.
    const byHandle = await db.orm.public.Product.where({
      shopId: shop.id,
      handle,
    }).first();

    if (byHandle) {
      await db.orm.public.Product.where({ id: byHandle.id }).update({
        shopifyProductId,
        title: product.title || handle,
        imageUrl: product.imageUrl,
        status: product.status || "active",
        lastSyncedAt: now,
      });
      updated += 1;
      continue;
    }

    await db.orm.public.Product.create({
      shopId: shop.id,
      shopifyProductId,
      handle,
      title: product.title || handle,
      imageUrl: product.imageUrl,
      status: product.status || "active",
      lastSyncedAt: now,
      avgRating: null,
      reviewCount: 0,
    });
    created += 1;
  }

  // Verify the error-sample products
  const sampleHandles = [
    "black-onyx-signet-ring",
    "5mm-cuban-chain-silver",
    "silver-your-moon-stars-ring",
    "silver-abalone-signet-ring",
    "compass-pendant-silver",
    "cuban-bracelet-gold-3mm",
    "cuban-chain-3mm-gold",
  ];
  const samples = [];
  for (const handle of sampleHandles) {
    const row = await db.orm.public.Product.where({
      shopId: shop.id,
      handle,
    }).first();
    samples.push(
      row
        ? { handle, shopifyProductId: row.shopifyProductId, ok: true }
        : { handle, ok: false },
    );
  }

  const total = await db.orm.public.Product.where({ shopId: shop.id }).all();
  console.log(
    JSON.stringify({ created, updated, productsInShop: total.length, samples }, null, 2),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
