/**
 * Run Loox CSV import against the local DB (bypasses hsxperts.co).
 *
 *   yarn tsx --import dotenv/config scripts/import-loox-local.ts
 */
import { readFile } from "node:fs/promises";
import { enqueueLooxImport } from "@/lib/queue";
import { createLooxImportJob } from "@/services/import/loox/runner";
import { saveImportCsv } from "@/services/media";
import { getDb } from "@/lib/prisma";

const LOOX_CSV =
  process.env.LOOX_CSV_PATH ??
  "/Users/apple/.cursor/projects/Users-apple-Developer-outrage-reviews/attachments/e5fb99b5-2a03-4d0a-9cf4-d6208bf4dd2e/reviews.NkWooXfb56.csv";

const SHOP_DOMAIN =
  process.env.SEED_SHOP_DOMAIN ?? "test-lcoemihp.myshopify.com";

async function main() {
  const db = getDb();
  const shop = await db.orm.public.Shop.where({
    shopifyDomain: SHOP_DOMAIN,
  }).first();
  if (!shop) throw new Error(`Shop not found: ${SHOP_DOMAIN}`);

  const csvContent = await readFile(LOOX_CSV, "utf8");
  const { job } = await createLooxImportJob(shop.id, csvContent);
  const csvPath = await saveImportCsv(job.id, csvContent);

  console.log(`Queued Loox import job ${job.id} for ${shop.shopifyDomain}`);
  await enqueueLooxImport({
    shopId: shop.id,
    syncJobId: job.id,
    csvPath,
  });

  // When SKIP_BACKGROUND_QUEUE is not set, worker:import must be running.
  // Poll for completion briefly.
  for (let i = 0; i < 120; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    const current = await db.orm.public.SyncJob.where({ id: job.id }).first();
    if (!current) continue;
    const payload = (current.payload ?? {}) as Record<string, unknown>;
    console.log(
      `[${i + 1}] status=${current.status} imported=${payload.importedReviews ?? 0} failed=${payload.failedRows ?? 0} skipped=${payload.skippedReviews ?? 0}`,
    );
    if (current.status === "completed" || current.status === "failed") {
      console.log(JSON.stringify({ status: current.status, payload, error: current.errorMessage }, null, 2));
      return;
    }
  }

  console.log("Still running — check yarn worker:import logs.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
