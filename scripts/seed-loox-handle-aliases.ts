/**
 * Ensure every Loox review handle exists as a product row.
 * When multiple Loox handles share one Shopify product ID, create
 * handle-alias rows with synthetic IDs so handle matching always works,
 * and keep one canonical row with the real Shopify ID.
 *
 *   yarn tsx --import dotenv/config scripts/seed-loox-handle-aliases.ts
 */
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDb, nowInstant } from "@/lib/prisma";

const LOOX_CSV =
  process.env.LOOX_CSV_PATH ??
  "/Users/apple/.cursor/projects/Users-apple-Developer-outrage-reviews/attachments/e5fb99b5-2a03-4d0a-9cf4-d6208bf4dd2e/reviews.NkWooXfb56.csv";

const SHOP_DOMAIN =
  process.env.SEED_SHOP_DOMAIN ?? "test-lcoemihp.myshopify.com";

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (char === "\r") continue;
    field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function main() {
  const db = getDb();
  const shop = await db.orm.public.Shop.where({
    shopifyDomain: SHOP_DOMAIN,
  }).first();
  if (!shop) throw new Error(`Shop not found: ${SHOP_DOMAIN}`);

  const content = await readFile(LOOX_CSV, "utf8");
  const table = parseCsv(content);
  const headers = table[0]?.map((h) => h.trim().toLowerCase()) ?? [];
  const handleIdx = headers.indexOf("handle");
  const productIdIdx = headers.findIndex((h) =>
    ["productid", "product_id", "shopify_product_id"].includes(h),
  );
  if (handleIdx < 0 || productIdIdx < 0) {
    throw new Error("Loox CSV missing handle/productId columns");
  }

  // Map: handle -> preferred shopify product id
  const handleToId = new Map<string, string>();
  for (const cells of table.slice(1)) {
    const handle = (cells[handleIdx] ?? "").trim();
    const productId = (cells[productIdIdx] ?? "").replace(/\D/g, "");
    if (!handle || !productId) continue;
    if (!handleToId.has(handle)) handleToId.set(handle, productId);
  }

  // Which real IDs are already claimed by a row?
  const claimedIds = new Map<string, string>(); // shopifyProductId -> product uuid
  const existing = await db.orm.public.Product.where({ shopId: shop.id }).all();
  for (const product of existing) {
    claimedIds.set(product.shopifyProductId, product.id);
  }

  const now = nowInstant();
  let created = 0;
  let updated = 0;

  for (const [handle, realId] of handleToId) {
    const byHandle = await db.orm.public.Product.where({
      shopId: shop.id,
      handle,
    }).first();

    const idOwner = claimedIds.get(realId);
    const canUseRealId =
      !idOwner ||
      (byHandle != null && idOwner === byHandle.id);

    const shopifyProductId = canUseRealId ? realId : `loox-alias-${handle}`.slice(0, 64);

    if (byHandle) {
      await db.orm.public.Product.where({ id: byHandle.id }).update({
        shopifyProductId,
        title: byHandle.title || handle.replace(/-/g, " "),
        lastSyncedAt: now,
        status: "active",
      });
      claimedIds.set(shopifyProductId, byHandle.id);
      updated += 1;
      continue;
    }

    const createdProduct = await db.orm.public.Product.create({
      shopId: shop.id,
      shopifyProductId,
      handle,
      title: handle.replace(/-/g, " "),
      imageUrl: null,
      status: "active",
      lastSyncedAt: now,
      avgRating: null,
      reviewCount: 0,
    });
    if (createdProduct) {
      claimedIds.set(shopifyProductId, createdProduct.id);
    }
    created += 1;
  }

  const samples = [];
  for (const handle of [
    "black-onyx-signet-ring",
    "5mm-cuban-chain-silver",
    "cuban-bracelet-gold-3mm",
    "cuban-chain-3mm-gold",
    "silver-your-moon-stars-ring",
  ]) {
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
    JSON.stringify(
      {
        shop: shop.shopifyDomain,
        looxHandles: handleToId.size,
        created,
        updated,
        productsInShop: total.length,
        samples,
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
