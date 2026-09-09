import { createHash } from "node:crypto";
import { getDb, nowInstant, toIsoString } from "@/lib/prisma";
import { env } from "@/lib/env";
import type { SummaryHighlight } from "@/lib/customer-say";
import { generateCursorReviewSummary } from "@/lib/ai/cursor-summary";

const SOURCE_LIMIT = 80;
const BODY_LIMIT = 420;
const MODEL_PREFIX = "cursor-approved-v1";

export const APPROVED_REVIEW_STATUSES = ["published", "approved"] as const;

export type PublishedReviewForSummary = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  updatedAt?: unknown;
};

export type ProductAiSummary = {
  summaryText: string;
  highlights: SummaryHighlight[];
  summarySourceCount: number;
  generatedAt: string;
  modelVersion: string;
};

const inFlight = new Map<string, Promise<ProductAiSummary | null>>();

function clip(text: string | null, max: number) {
  const cleaned = (text ?? "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned || null;
  return `${cleaned.slice(0, max).trim()}…`;
}

export function fingerprintPublishedReviews(
  reviews: PublishedReviewForSummary[],
) {
  const payload = reviews
    .map((review) => ({
      id: review.id,
      rating: review.rating,
      title: clip(review.title, 120),
      body: clip(review.body, BODY_LIMIT),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24);
}

function modelVersionFor(fingerprint: string) {
  return `${MODEL_PREFIX}:${fingerprint}`;
}

export async function listPublishedReviewsForSummary(input: {
  shopId: string;
  productId: string;
}) {
  const db = getDb();
  return db.orm.public.Review.where({
    shopId: input.shopId,
    productId: input.productId,
  })
    .where((review) => review.status.in([...APPROVED_REVIEW_STATUSES]))
    .select("id", "rating", "title", "body", "updatedAt")
    .orderBy((review) => review.publishedAt.desc())
    .limit(SOURCE_LIMIT)
    .all();
}

export function fallbackSummaryFromReviews(input: {
  productTitle: string | null;
  reviews: PublishedReviewForSummary[];
}) {
  const withText = input.reviews.filter(
    (review) => clip(review.body, BODY_LIMIT) || clip(review.title, 80),
  );
  const subject = input.productTitle ? `the ${input.productTitle}` : "this product";
  if (withText.length === 0) {
    const count = input.reviews.length;
    if (count === 0) {
      return "No approved reviews yet. Once reviews are approved, a summary will appear here.";
    }
    return `Customers have ${count} approved review${count === 1 ? "" : "s"} of ${subject}. Written comments will appear in this summary as soon as shoppers add them.`;
  }

  const quotes = withText
    .slice(0, 3)
    .map((review) => clip(review.body, 90) || clip(review.title, 80))
    .filter((quote): quote is string => Boolean(quote));
  const quoted = quotes.map((quote) => `“${quote}”`).join(" ");
  return `Shoppers reviewing ${subject} mention ${quoted} Across ${input.reviews.length} approved review${input.reviews.length === 1 ? "" : "s"}, the overall tone is ${averageTone(input.reviews)}.`;
}

function averageTone(reviews: PublishedReviewForSummary[]) {
  const avg =
    reviews.reduce((total, review) => total + Number(review.rating || 0), 0) /
    Math.max(reviews.length, 1);
  if (avg >= 4.5) return "very positive";
  if (avg >= 3.5) return "positive";
  if (avg >= 2.5) return "mixed";
  return "critical";
}

async function persistSummary(input: {
  shopId: string;
  productId: string;
  summaryText: string;
  highlights: SummaryHighlight[];
  sentimentScore: number | null;
  modelVersion: string;
}) {
  const db = getDb();
  const generatedAt = nowInstant();
  const existing = await db.orm.public.AiSummary.where({
    shopId: input.shopId,
    productId: input.productId,
  }).first();

  if (existing) {
    await db.orm.public.AiSummary.where({ id: existing.id }).update({
      summaryText: input.summaryText,
      highlights: input.highlights,
      sentimentScore: input.sentimentScore,
      modelVersion: input.modelVersion,
      generatedAt,
    });
  } else {
    await db.orm.public.AiSummary.create({
      shopId: input.shopId,
      productId: input.productId,
      summaryText: input.summaryText,
      highlights: input.highlights,
      sentimentScore: input.sentimentScore,
      modelVersion: input.modelVersion,
      generatedAt,
    });
  }

  return {
    summaryText: input.summaryText,
    highlights: input.highlights,
    summarySourceCount: 0,
    generatedAt: toIsoString(generatedAt) ?? new Date().toISOString(),
    modelVersion: input.modelVersion,
  };
}

export async function loadCachedAiSummary(input: {
  shopId: string;
  productId: string;
  fingerprint: string;
}) {
  const db = getDb();
  const existing = await db.orm.public.AiSummary.where({
    shopId: input.shopId,
    productId: input.productId,
  }).first();
  if (!existing?.summaryText?.trim()) return null;

  const expected = modelVersionFor(input.fingerprint);
  const isCurrent =
    existing.modelVersion === expected ||
    existing.modelVersion === `fallback:${input.fingerprint}`;
  return {
    summaryText: existing.summaryText,
    highlights: Array.isArray(existing.highlights)
      ? (existing.highlights as SummaryHighlight[])
      : [],
    summarySourceCount: 0,
    generatedAt: toIsoString(existing.generatedAt) ?? "",
    modelVersion: existing.modelVersion ?? "",
    isCurrent,
  };
}

export async function generateAndStoreProductSummary(input: {
  shopId: string;
  productId: string;
  productTitle: string | null;
  avgRating?: number | null;
  reviews?: PublishedReviewForSummary[];
  force?: boolean;
}): Promise<ProductAiSummary | null> {
  const key = `${input.shopId}:${input.productId}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const task = (async () => {
    const reviews =
      input.reviews ??
      (await listPublishedReviewsForSummary({
        shopId: input.shopId,
        productId: input.productId,
      }));
    if (reviews.length === 0) return null;

    const fingerprint = fingerprintPublishedReviews(reviews);
    if (!input.force) {
      const cached = await loadCachedAiSummary({
        shopId: input.shopId,
        productId: input.productId,
        fingerprint,
      });
      if (cached?.isCurrent) {
        return {
          ...cached,
          summarySourceCount: reviews.length,
        };
      }
    }

    const highlightsFallback: SummaryHighlight[] = [];
    const sentimentScore =
      input.avgRating != null ? Number(input.avgRating) / 5 : null;

    if (!env.cursorApiKey()) {
      const saved = await persistSummary({
        shopId: input.shopId,
        productId: input.productId,
        summaryText: fallbackSummaryFromReviews({
          productTitle: input.productTitle,
          reviews,
        }),
        highlights: highlightsFallback,
        sentimentScore,
        modelVersion: `fallback:${fingerprint}`,
      });
      return { ...saved, summarySourceCount: reviews.length };
    }

    try {
      const generated = await generateCursorReviewSummary({
        productTitle: input.productTitle || "this product",
        reviews: reviews.map((review) => ({
          rating: review.rating,
          title: clip(review.title, 120),
          body: clip(review.body, BODY_LIMIT),
        })),
      });

      const saved = await persistSummary({
        shopId: input.shopId,
        productId: input.productId,
        summaryText: generated.summary,
        highlights:
          generated.highlights.length > 0
            ? generated.highlights
            : highlightsFallback,
        sentimentScore,
        modelVersion: modelVersionFor(fingerprint),
      });
      return { ...saved, summarySourceCount: reviews.length };
    } catch (error) {
      console.error("[ai-summary] Cursor generation failed:", error);
      const saved = await persistSummary({
        shopId: input.shopId,
        productId: input.productId,
        summaryText: fallbackSummaryFromReviews({
          productTitle: input.productTitle,
          reviews,
        }),
        highlights: highlightsFallback,
        sentimentScore,
        modelVersion: `fallback:${fingerprint}`,
      });
      return { ...saved, summarySourceCount: reviews.length };
    }
  })();

  inFlight.set(key, task);
  try {
    return await task;
  } finally {
    inFlight.delete(key);
  }
}
