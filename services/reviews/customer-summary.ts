import { getDb, nowInstant, toIsoString, type DbInstant } from "@/lib/prisma";
import {
  isPlaceholderCustomerSummary,
  normalizeCustomerSayPayload as normalizeCustomerSayViewModel,
} from "@/lib/customer-say";
import { ensureProductSynced } from "@/services/products/ensure-synced";
import {
  APPROVED_REVIEW_STATUSES,
  fallbackSummaryFromReviews,
  fingerprintPublishedReviews,
  generateAndStoreProductSummary,
  loadCachedAiSummary,
} from "@/services/reviews/ai-summary";

export type SummaryHighlight = {
  label: string;
  count: number;
};

export type SummarySnippet = {
  id: string;
  quote: string;
  reviewerName: string | null;
  rating: number;
  isVerifiedPurchase: boolean;
};

export type CustomerSayStoreReply = {
  body: string;
  authorName: string | null;
  publishedAt: string | null;
};

export type CustomerSayPayload = {
  productId: string | null;
  productTitle: string | null;
  rating: number | null;
  count: number;
  verifiedCount: number;
  summaryText: string;
  summarySourceCount: number;
  summaryGeneratedAt: string;
  summaryIsReady?: boolean;
  highlights: SummaryHighlight[];
  snippets: SummarySnippet[];
  reviews: Array<{
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    reviewerName: string | null;
    isVerifiedPurchase: boolean;
    publishedAt: string | null;
    createdAt: string;
    productTitle: string | null;
    merchantReply: string | null;
    merchantRepliedAt: string | null;
    replies: CustomerSayStoreReply[];
    media: Array<{
      id: string;
      url: string;
      thumbnailUrl: string | null;
      type: string;
    }>;
  }>;
  reviewsTotal: number;
  reviewsOffset: number;
  reviewsLimit: number;
  hasMoreReviews: boolean;
};

const SUMMARY_SOURCE_LIMIT = 200;
const SNIPPET_LIMIT = 6;

const THEME_PATTERNS: Array<{ label: string; patterns: RegExp[] }> = [
  {
    label: "Great quality for the price",
    patterns: [/quality/i, /well.?made/i, /craftsmanship/i, /premium/i, /excellent/i],
  },
  {
    label: "Great gift reaction",
    patterns: [/gift/i, /present/i, /birthday/i, /christmas/i, /anniversary/i],
  },
  {
    label: "Solid, weighty feel",
    patterns: [/weight/i, /weighty/i, /heavy/i, /solid/i, /substantial/i, /sturdy/i],
  },
  {
    label: "Comfortable daily wear",
    patterns: [/comfort/i, /daily/i, /wear/i, /fit/i, /soft/i],
  },
  {
    label: "Fast delivery",
    patterns: [/delivery/i, /shipping/i, /arrived/i, /fast/i, /quick/i],
  },
  {
    label: "Looks even better in person",
    patterns: [/looks/i, /beautiful/i, /stunning/i, /gorgeous/i, /picture/i],
  },
];

function truncateQuote(text: string, max = 110) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  const slice = cleaned.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${(lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim()}…`;
}

function mapStoreReplies(
  replies: Array<{
    body: string;
    authorName: string | null;
    publishedAt: DbInstant | Date | string | null;
  }>,
): CustomerSayStoreReply[] {
  return [...replies]
    .map((reply) => ({
      body: reply.body.trim(),
      authorName: reply.authorName,
      publishedAt: toIsoString(reply.publishedAt),
    }))
    .filter((reply) => reply.body.length > 0)
    .sort((a, b) => {
      const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bTime - aTime;
    });
}

function resolveMerchantReply(
  merchantReply: string | null,
  merchantRepliedAt: DbInstant | Date | string | null | undefined,
  replies: CustomerSayStoreReply[],
) {
  const fromColumn = merchantReply?.trim() || null;
  if (fromColumn) {
    return {
      merchantReply: fromColumn,
      merchantRepliedAt: toIsoString(merchantRepliedAt),
    };
  }

  const latest = replies[0];
  if (!latest) {
    return {
      merchantReply: null as string | null,
      merchantRepliedAt: null as string | null,
    };
  }

  return {
    merchantReply: latest.body,
    merchantRepliedAt: latest.publishedAt,
  };
}

function firstSentence(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^(.{20,120}?[.!?])(?:\s|$)/);
  if (match) return match[1].trim();
  return truncateQuote(cleaned, 100);
}

function countThemeMatches(body: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(body)) ? 1 : 0;
}

function buildHighlights(reviewBodies: string[]) {
  const counts = THEME_PATTERNS.map((theme) => ({
    label: theme.label,
    count: reviewBodies.reduce(
      (total, body) => total + countThemeMatches(body, theme.patterns),
      0,
    ),
  }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  return counts.slice(0, 5);
}

function formatSummaryMonth(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export async function buildCustomerSayPayload(input: {
  shopId: string;
  shopifyProductId: string;
  reviewsOffset?: number;
  reviewsLimit?: number;
  includeReviews?: boolean;
  waitForSummary?: boolean;
}) {
  const db = getDb();
  let product = await db.orm.public.Product.where({
    shopId: input.shopId,
    shopifyProductId: input.shopifyProductId,
  }).first();

  if (!product) {
    product = await ensureProductSynced(input.shopId, input.shopifyProductId);
  }

  if (!product) {
    return emptyPayload(input.reviewsOffset ?? 0, input.reviewsLimit ?? 10);
  }

  const publishedTotalResult = await db.orm.public.Review.where({
    shopId: input.shopId,
    productId: product.id,
  })
    .where((review) => review.status.in([...APPROVED_REVIEW_STATUSES]))
    .aggregate((agg) => ({ count: agg.count() }));

  const publishedCount = Number(publishedTotalResult?.count ?? 0);

  const sourceReviews = await db.orm.public.Review.where({
    shopId: input.shopId,
    productId: product.id,
  })
    .where((review) => review.status.in([...APPROVED_REVIEW_STATUSES]))
    .select(
      "id",
      "rating",
      "title",
      "body",
      "reviewerName",
      "isVerifiedPurchase",
      "updatedAt",
    )
    .orderBy((review) => review.publishedAt.desc())
    .limit(SUMMARY_SOURCE_LIMIT)
    .all();

  const verifiedCount = sourceReviews.filter(
    (review) => review.isVerifiedPurchase,
  ).length;

  const bodies = sourceReviews
    .map((review) => review.body?.trim())
    .filter((body): body is string => Boolean(body));

  const heuristicHighlights = buildHighlights(bodies);
  const fingerprint = fingerprintPublishedReviews(sourceReviews);
  const cached = await loadCachedAiSummary({
    shopId: input.shopId,
    productId: product.id,
    fingerprint,
  });

  const immediateSummary = fallbackSummaryFromReviews({
    productTitle: product.title,
    reviews: sourceReviews,
  });
  let summaryText =
    cached?.summaryText && !isPlaceholderCustomerSummary(cached.summaryText)
      ? cached.summaryText
      : immediateSummary;
  let highlights =
    cached?.highlights?.length ? cached.highlights : heuristicHighlights;
  let generatedAtIso =
    cached?.generatedAt || toIsoString(nowInstant()) || new Date().toISOString();
  const summarySourceCount = sourceReviews.length;
  let summaryIsReady = Boolean(cached?.isCurrent);

  if (publishedCount > 0 && !cached?.isCurrent) {
    const generate = () =>
      generateAndStoreProductSummary({
        shopId: input.shopId,
        productId: product.id,
        productTitle: product.title,
        avgRating: product.avgRating,
        reviews: sourceReviews,
      });

    if (input.waitForSummary) {
      try {
        const generated = await generate();
        if (generated?.summaryText) {
          summaryText = generated.summaryText;
          highlights =
            generated.highlights.length > 0
              ? generated.highlights
              : heuristicHighlights;
          generatedAtIso = generated.generatedAt;
          summaryIsReady = true;
        }
      } catch (error) {
        console.error("[ai-summary] generation failed:", error);
      }
    } else {
      void generate().catch((error) => {
        console.error("[ai-summary] generation failed:", error);
      });
    }
  }

  const snippetCandidates = sourceReviews.filter(
    (review) =>
      Boolean(review.body?.trim() || review.title?.trim()) && review.rating >= 1,
  );

  const snippets: SummarySnippet[] = snippetCandidates
    .slice(0, SNIPPET_LIMIT)
    .map((review) => ({
      id: review.id,
      quote: firstSentence(review.body?.trim() || review.title || ""),
      reviewerName: review.reviewerName,
      rating: review.rating,
      isVerifiedPurchase: review.isVerifiedPurchase,
    }));

  let reviews: CustomerSayPayload["reviews"] = [];
  let reviewsTotal = publishedCount;
  const reviewsOffset = input.reviewsOffset ?? 0;
  const reviewsLimit = Math.min(input.reviewsLimit ?? 10, 50);

  if (input.includeReviews) {
    const rows = await db.orm.public.Review.where({
      shopId: input.shopId,
      productId: product.id,
    })
      .where((review) => review.status.in([...APPROVED_REVIEW_STATUSES]))
      .include("media", (media) =>
        media
          .select("id", "url", "thumbnailUrl", "type", "sortOrder")
          .orderBy((item) => item.sortOrder.asc()),
      )
      .include("replies", (replies) =>
        replies
          .select("id", "body", "authorName", "publishedAt")
          .orderBy((item) => item.publishedAt.desc()),
      )
      .orderBy((review) => review.publishedAt.desc())
      .offset(reviewsOffset)
      .limit(reviewsLimit)
      .all();

    reviews = rows.map((review) => {
      const replies = mapStoreReplies(review.replies ?? []);
      const storeReply = resolveMerchantReply(
        review.merchantReply ?? null,
        review.merchantRepliedAt,
        replies,
      );

      return {
        id: review.id,
        rating: review.rating,
        title: review.title,
        body: review.body,
        reviewerName: review.reviewerName,
        isVerifiedPurchase: review.isVerifiedPurchase,
        publishedAt: toIsoString(review.publishedAt),
        createdAt: toIsoString(review.createdAt) ?? "",
        productTitle: product.title,
        merchantReply: storeReply.merchantReply,
        merchantRepliedAt: storeReply.merchantRepliedAt,
        replies,
        media: [...review.media]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((item) => ({
            id: item.id,
            url: item.url,
            thumbnailUrl: item.thumbnailUrl,
            type: item.type,
          })),
      };
    });

    reviewsTotal = publishedCount;
  }

  const displayCount = Math.max(Number(product.reviewCount), publishedCount);

  return {
    productId: product.id,
    productTitle: product.title,
    rating: product.avgRating != null ? Number(product.avgRating) : null,
    count: displayCount,
    verifiedCount,
    summaryText,
    summarySourceCount,
    summaryGeneratedAt: generatedAtIso,
    summaryMonthLabel: formatSummaryMonth(new Date(generatedAtIso)),
    summaryIsReady,
    highlights,
    snippets,
    reviews,
    reviewsTotal: Number(reviewsTotal),
    reviewsOffset,
    reviewsLimit,
    hasMoreReviews:
      reviewsOffset + reviews.length < Number(reviewsTotal),
  } satisfies CustomerSayPayload & { summaryMonthLabel: string; summaryIsReady: boolean };
}

export function emptyPayload(
  offset: number,
  limit: number,
  overrides: Partial<
    CustomerSayPayload & { summaryMonthLabel: string; summaryIsReady: boolean }
  > = {},
): CustomerSayPayload & { summaryMonthLabel: string; summaryIsReady: boolean } {
  const generatedAt = nowInstant();
  return {
    productId: null,
    productTitle: null,
    rating: null,
    count: 0,
    verifiedCount: 0,
    summaryText:
      "No approved reviews yet. Once reviews are approved, a summary will appear here.",
    summarySourceCount: 0,
    summaryGeneratedAt: toIsoString(generatedAt) ?? "",
    summaryMonthLabel: formatSummaryMonth(new Date(toIsoString(generatedAt) ?? "")),
    summaryIsReady: false,
    highlights: [],
    snippets: [],
    reviews: [],
    reviewsTotal: 0,
    reviewsOffset: offset,
    reviewsLimit: limit,
    hasMoreReviews: false,
    ...overrides,
  };
}

export function normalizeCustomerSayPayload(
  input: Record<string, unknown>,
): CustomerSayPayload & { summaryMonthLabel?: string } {
  const normalized = normalizeCustomerSayViewModel(input);
  return {
    ...normalized,
    reviews: normalized.reviews.map((review) => {
      const extended = review as CustomerSayPayload["reviews"][number];
      const replies = Array.isArray(extended.replies)
        ? extended.replies
            .map((reply) => ({
              body: String(reply.body ?? "").trim(),
              authorName: reply.authorName ?? null,
              publishedAt: reply.publishedAt ?? null,
            }))
            .filter((reply) => reply.body.length > 0)
        : [];
      const storeReply = resolveMerchantReply(
        extended.merchantReply ?? null,
        extended.merchantRepliedAt,
        replies,
      );

      return {
        id: review.id,
        rating: review.rating,
        title: review.title,
        body: review.body,
        reviewerName: review.reviewerName,
        isVerifiedPurchase: review.isVerifiedPurchase,
        publishedAt: review.publishedAt ?? null,
        createdAt: toIsoString(review.createdAt) ?? new Date().toISOString(),
        productTitle: extended.productTitle ?? null,
        merchantReply: storeReply.merchantReply,
        merchantRepliedAt: storeReply.merchantRepliedAt,
        replies,
        media: extended.media ?? [],
      };
    }),
  };
}

export async function listPreviewProducts(shopId: string, limit = 12) {
  const db = getDb();
  const products = await db.orm.public.Product.where({ shopId })
    .orderBy((product) => product.reviewCount.desc())
    .limit(limit * 3)
    .all();

  return products.filter((product) => Number(product.reviewCount) > 0).slice(0, limit);
}
