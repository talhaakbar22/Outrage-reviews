import { getDb, toIsoString } from "@/lib/prisma";

const EXPORT_BATCH_SIZE = 500;

const CSV_HEADERS = [
  "id",
  "product_handle",
  "product_id",
  "product_title",
  "rating",
  "title",
  "body",
  "author",
  "email",
  "created_at",
  "photo_url",
  "reply",
  "replied_at",
  "verified_purchase",
  "status",
  "source",
] as const;

function csvEscape(value: string | number | boolean | null | undefined) {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function buildShopReviewsCsv(shopId: string) {
  const db = getDb();
  const lines: string[] = [CSV_HEADERS.join(",")];
  let offset = 0;

  for (;;) {
    const rows = await db.orm.public.Review.where({ shopId })
      .include("product", (product) =>
        product.select("title", "handle", "shopifyProductId"),
      )
      .include("media", (media) =>
        media
          .select("url", "sortOrder")
          .orderBy((item) => item.sortOrder.asc()),
      )
      .orderBy((review) => review.createdAt.desc())
      .offset(offset)
      .limit(EXPORT_BATCH_SIZE)
      .all();

    if (rows.length === 0) break;

    for (const review of rows) {
      const photos = [...review.media]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => item.url)
        .filter(Boolean)
        .join(" | ");

      lines.push(
        [
          csvEscape(review.externalId || review.id),
          csvEscape(review.product.handle),
          csvEscape(review.product.shopifyProductId),
          csvEscape(review.product.title),
          csvEscape(review.rating),
          csvEscape(review.title),
          csvEscape(review.body),
          csvEscape(review.reviewerName),
          csvEscape(review.reviewerEmail),
          csvEscape(toIsoString(review.createdAt) ?? ""),
          csvEscape(photos),
          csvEscape(review.merchantReply),
          csvEscape(toIsoString(review.merchantRepliedAt) ?? ""),
          csvEscape(review.isVerifiedPurchase ? "TRUE" : "FALSE"),
          csvEscape(review.status),
          csvEscape(review.source),
        ].join(","),
      );
    }

    offset += rows.length;
    if (rows.length < EXPORT_BATCH_SIZE) break;
  }

  return {
    csv: `${lines.join("\n")}\n`,
    count: Math.max(0, lines.length - 1),
  };
}
