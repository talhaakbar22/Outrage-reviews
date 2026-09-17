import { getDb, nowInstant } from "@/lib/prisma";
import { parseProductCsv } from "@/services/import/products/parser";
import { upsertProduct } from "@/services/products/repository";

export type ProductCsvImportResult = {
  totalRows: number;
  created: number;
  updated: number;
  failedRows: number;
  errors: string[];
};

export async function importProductsFromCsv(input: {
  shopId: string;
  csvContent: string;
}): Promise<ProductCsvImportResult> {
  const { rows, parseErrors } = parseProductCsv(input.csvContent);
  const result: ProductCsvImportResult = {
    totalRows: rows.length,
    created: 0,
    updated: 0,
    failedRows: 0,
    errors: [...parseErrors],
  };

  const db = getDb();
  const usedShopifyIds = new Set<string>();
  const existing = await db.orm.public.Product.where({
    shopId: input.shopId,
  }).all();
  for (const product of existing) {
    usedShopifyIds.add(product.shopifyProductId);
  }

  const now = nowInstant();

  for (const row of rows) {
    try {
      const handle = row.handle.trim();
      if (!handle) {
        result.failedRows += 1;
        result.errors.push("Skipped row with empty handle");
        continue;
      }

      const byHandle = await db.orm.public.Product.where({
        shopId: input.shopId,
        handle,
      }).first();

      let shopifyProductId = row.shopifyProductId?.trim() || "";

      if (byHandle) {
        const nextId =
          (shopifyProductId &&
          (!usedShopifyIds.has(shopifyProductId) ||
            byHandle.shopifyProductId === shopifyProductId)
            ? shopifyProductId
            : null) ||
          byHandle.shopifyProductId ||
          `csv-${handle}`.slice(0, 64);

        await db.orm.public.Product.where({ id: byHandle.id }).update({
          title: row.title || handle,
          imageUrl: row.imageUrl ?? byHandle.imageUrl,
          status: row.status,
          shopifyProductId: nextId,
          lastSyncedAt: now,
        });
        usedShopifyIds.add(nextId);
        result.updated += 1;
        continue;
      }

      if (!shopifyProductId || usedShopifyIds.has(shopifyProductId)) {
        shopifyProductId = `csv-${handle}`.slice(0, 64);
      }
      if (usedShopifyIds.has(shopifyProductId)) {
        shopifyProductId =
          `csv-${handle}-${result.created + result.updated}`.slice(0, 64);
      }

      await upsertProduct(input.shopId, {
        shopifyProductId,
        title: row.title || handle,
        handle,
        imageUrl: row.imageUrl,
        status: row.status,
        lastSyncedAt: now,
      });
      usedShopifyIds.add(shopifyProductId);
      result.created += 1;
    } catch (error) {
      result.failedRows += 1;
      result.errors.push(
        `${row.handle}: ${error instanceof Error ? error.message : "Import failed"}`,
      );
    }
  }

  result.errors = result.errors.slice(0, 100);
  return result;
}
