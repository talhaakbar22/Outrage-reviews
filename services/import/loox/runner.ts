import type { Session } from "@shopify/shopify-api";
import { getDb } from "@/lib/prisma";
import { parseLooxCsv } from "@/services/import/loox/parser";
import type { LooxImportProgress, LooxImportSummary } from "@/services/import/loox/types";
import { downloadReviewImage } from "@/services/media/storage";
import { resolveProductForLooxRow } from "@/services/products/repository";
import {
  createImportedReview,
  findReviewByExternalId,
  publishProductRatings,
} from "@/services/reviews/repository";

function emptyProgress(totalRows = 0): LooxImportProgress {
  return {
    totalRows,
    processedRows: 0,
    importedReviews: 0,
    skippedReviews: 0,
    failedRows: 0,
    downloadedImages: 0,
    failedImages: 0,
    productsUpdated: 0,
    errors: [],
  };
}

async function updateSyncJob(syncJobId: string, patch: Record<string, unknown>) {
  const db = getDb();
  await db.orm.public.SyncJob.where({ id: syncJobId }).update(patch);
}

export async function runLooxImport(input: {
  shopId: string;
  syncJobId: string;
  csvContent: string;
  session: Session;
}): Promise<LooxImportSummary> {
  const db = getDb();
  const { rows, parseErrors } = parseLooxCsv(input.csvContent);
  const progress = emptyProgress(rows.length);
  progress.errors.push(...parseErrors.slice(0, 50));

  const touchedProductIds = new Set<string>();

  await updateSyncJob(input.syncJobId, {
    status: "running",
    startedAt: new Date(),
    payload: { phase: "import", ...progress },
  });

  try {
    for (const row of rows) {
      progress.processedRows += 1;

      try {
        const existing = await findReviewByExternalId(input.shopId, row.externalId);
        if (existing) {
          progress.skippedReviews += 1;
          continue;
        }

        const productId = await resolveProductForLooxRow(input.shopId, row);
        if (!productId) {
          progress.failedRows += 1;
          progress.errors.push(
            `Review ${row.externalId}: no matching product (handle=${row.productHandle ?? "—"}, productId=${row.shopifyProductId ?? "—"})`,
          );
          continue;
        }

        const media: Array<{ type: "image"; url: string; sortOrder: number }> = [];

        for (const [index, sourceUrl] of row.photoUrls.entries()) {
          try {
            const stored = await downloadReviewImage({
              shopId: input.shopId,
              reviewExternalId: row.externalId,
              sourceUrl,
              index,
            });
            media.push({
              type: "image",
              url: stored.publicUrl,
              sortOrder: index,
            });
            progress.downloadedImages += 1;
          } catch (error) {
            progress.failedImages += 1;
            progress.errors.push(
              `Review ${row.externalId}: failed to download image ${sourceUrl} (${error instanceof Error ? error.message : "unknown error"})`,
            );
          }
        }

        await createImportedReview({
          shopId: input.shopId,
          productId,
          externalId: row.externalId,
          rating: row.rating,
          title: row.title,
          body: row.body,
          reviewerName: row.reviewerName,
          reviewerEmail: row.reviewerEmail,
          isVerifiedPurchase: row.isVerifiedPurchase,
          status: row.status,
          createdAt: row.createdAt,
          publishedAt: row.status === "published" ? row.createdAt : null,
          merchantReply: row.merchantReply,
          merchantRepliedAt: row.merchantRepliedAt,
          media,
        });

        progress.importedReviews += 1;
        touchedProductIds.add(productId);
      } catch (error) {
        progress.failedRows += 1;
        progress.errors.push(
          `Review ${row.externalId}: ${error instanceof Error ? error.message : "Import failed"}`,
        );
      }

      if (progress.processedRows % 25 === 0) {
        await updateSyncJob(input.syncJobId, {
          payload: { phase: "import", ...progress, errors: progress.errors.slice(-50) },
        });
      }
    }

    for (const productId of touchedProductIds) {
      try {
        await publishProductRatings(productId);
        progress.productsUpdated += 1;
      } catch (error) {
        progress.errors.push(
          `Product ${productId}: rating sync failed (${error instanceof Error ? error.message : "unknown error"})`,
        );
      }
    }

    const summary: LooxImportSummary = {
      ...progress,
      syncJobId: input.syncJobId,
      errors: progress.errors.slice(-100),
    };

    await updateSyncJob(input.syncJobId, {
      status: "completed",
      completedAt: new Date(),
      payload: { phase: "complete", ...summary },
    });

    return summary;
  } catch (error) {
    await updateSyncJob(input.syncJobId, {
      status: "failed",
      completedAt: new Date(),
      errorMessage: error instanceof Error ? error.message : "Loox import failed",
      payload: { phase: "failed", ...progress },
    });
    throw error;
  }
}

export async function createLooxImportJob(shopId: string, csvContent: string) {
  const db = getDb();
  const job = await db.orm.public.SyncJob.create({
    shopId,
    type: "reviews_import",
    status: "pending",
    payload: {
      phase: "queued",
      byteSize: Buffer.byteLength(csvContent, "utf8"),
    },
  });

  if (!job) {
    throw new Error("Failed to create import job");
  }

  return { job, csvContent };
}
