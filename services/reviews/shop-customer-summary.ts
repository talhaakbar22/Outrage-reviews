import { getDb, nowInstant, toIsoString } from "@/lib/prisma";
import {
  isPlaceholderCustomerSummary,
} from "@/lib/customer-say";
import {
  buildHeuristicHighlights,
  enrichHighlightsWithReviewIds,
  reviewMatchesHighlight,
} from "@/lib/customer-say-highlights";
import {
  APPROVED_REVIEW_STATUSES,
  fallbackSummaryFromReviews,
} from "@/services/reviews/ai-summary";
import {
  emptyPayload,
  type CustomerSayPayload,
} from "@/services/reviews/customer-summary";

const SUMMARY_SOURCE_LIMIT = 200;
const SNIPPET_LIMIT = 4;
const SNIPPET_MIN_RATING = 4;

function truncateQuote(text: string, max = 110) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  const slice = cleaned.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${(lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim()}…`;
}

function firstSentence(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^(.{20,120}?[.!?])(?:\s|$)/);
  if (match) return match[1]!.trim();
  return truncateQuote(cleaned, 100);
}

function formatSummaryMonth(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/**
 * Store-wide “What customers say” / All reviews feed (no product_id).
 * Same shape as product customer-say so the theme widget can reuse the JS.
 */
export async function buildShopCustomerSayPayload(input: {
  shopId: string;
  reviewsOffset?: number;
  reviewsLimit?: number;
  includeReviews?: boolean;
  skipSummary?: boolean;
  highlightLabel?: string | null;
  highlightReviewIds?: string[] | null;
}) {
  const db = getDb();
  const reviewsOffset = input.reviewsOffset ?? 0;
  const reviewsLimit = Math.min(input.reviewsLimit ?? 10, 50);

  const publishedTotalResult = await db.orm.public.Review.where({
    shopId: input.shopId,
  })
    .where((review) => review.status.in([...APPROVED_REVIEW_STATUSES]))
    .aggregate((agg) => ({
      count: agg.count(),
      averageRating: agg.avg("rating"),
    }));

  const publishedCount = Number(publishedTotalResult?.count ?? 0);
  if (publishedCount <= 0) {
    return emptyPayload(reviewsOffset, reviewsLimit, {
      productTitle: "All products",
      summaryText:
        "No approved reviews yet. Once reviews are approved, a store summary will appear here.",
    });
  }

  const averageRating = Number(publishedTotalResult?.averageRating ?? 0);

  const sourceReviews = await db.orm.public.Review.where({
    shopId: input.shopId,
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
      "productId",
    )
    .orderBy((review) => review.publishedAt.desc())
    .limit(SUMMARY_SOURCE_LIMIT)
    .all();

  const verifiedCount = sourceReviews.filter(
    (review) => review.isVerifiedPurchase,
  ).length;

  const heuristicHighlights = buildHeuristicHighlights(sourceReviews);
  const immediateSummary = fallbackSummaryFromReviews({
    productTitle: "our products",
    reviews: sourceReviews,
  });
  const summaryText = isPlaceholderCustomerSummary(immediateSummary)
    ? `Shoppers have left ${publishedCount.toLocaleString()} approved review${
        publishedCount === 1 ? "" : "s"
      } across the store. Browse highlights and recent comments below.`
    : immediateSummary;

  const highlights = heuristicHighlights;
  const generatedAtIso = toIsoString(nowInstant()) || new Date().toISOString();

  const highlightLabel = input.highlightLabel?.trim() || null;
  const highlightReviewIds = (input.highlightReviewIds ?? [])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  const matchingSourceIds = (() => {
    if (highlightReviewIds.length > 0) {
      return new Set(highlightReviewIds);
    }
    if (!highlightLabel) return null;
    const fromHighlight = highlights.find(
      (item) =>
        item.label.toLowerCase() === highlightLabel.toLowerCase() &&
        (item.reviewIds?.length ?? 0) > 0,
    );
    if (fromHighlight?.reviewIds?.length) {
      return new Set(fromHighlight.reviewIds);
    }
    return new Set(
      sourceReviews
        .filter((review) => reviewMatchesHighlight(review, highlightLabel))
        .map((review) => review.id),
    );
  })();

  const enrichedHighlights = enrichHighlightsWithReviewIds(
    highlights,
    sourceReviews,
  );

  const snippetCandidates = [...sourceReviews]
    .filter((review) => {
      const quote = (review.body?.trim() || review.title?.trim() || "").length;
      return quote > 0 && Number(review.rating) >= SNIPPET_MIN_RATING;
    })
    .sort((a, b) => Number(b.rating) - Number(a.rating));

  const snippets = snippetCandidates.slice(0, SNIPPET_LIMIT).map((review) => ({
    id: review.id,
    quote: firstSentence(review.body?.trim() || review.title || ""),
    reviewerName: review.reviewerName,
    rating: review.rating,
    isVerifiedPurchase: review.isVerifiedPurchase,
  }));

  let reviews: CustomerSayPayload["reviews"] = [];
  let reviewsTotal = publishedCount;

  if (input.includeReviews) {
    const fetchLimit = matchingSourceIds
      ? Math.min(SUMMARY_SOURCE_LIMIT, 200)
      : reviewsLimit;
    const fetchOffset = matchingSourceIds ? 0 : reviewsOffset;

    const rows = await db.orm.public.Review.where({
      shopId: input.shopId,
    })
      .where((review) => review.status.in([...APPROVED_REVIEW_STATUSES]))
      .include("product", (product) =>
        product.select("id", "title", "handle", "shopifyProductId"),
      )
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
      .offset(fetchOffset)
      .limit(fetchLimit)
      .all();

    const mapped = rows.map((review) => {
      const replies = (review.replies ?? [])
        .map((reply) => ({
          body: String(reply.body || "").trim(),
          authorName: reply.authorName,
          publishedAt: toIsoString(reply.publishedAt),
        }))
        .filter((reply) => reply.body.length > 0);

      return {
        id: review.id,
        rating: review.rating,
        title: review.title,
        body: review.body,
        reviewerName: review.reviewerName,
        isVerifiedPurchase: review.isVerifiedPurchase,
        publishedAt: toIsoString(review.publishedAt),
        createdAt: toIsoString(review.createdAt) ?? "",
        productTitle: review.product?.title ?? null,
        productHandle: review.product?.handle ?? null,
        merchantReply: review.merchantReply ?? replies[0]?.body ?? null,
        merchantRepliedAt:
          toIsoString(review.merchantRepliedAt) ??
          replies[0]?.publishedAt ??
          null,
        replies,
        media: [...(review.media ?? [])]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((item) => ({
            id: item.id,
            url: item.url,
            thumbnailUrl: item.thumbnailUrl,
            type: item.type,
          })),
      };
    });

    if (matchingSourceIds) {
      const filtered = mapped.filter((review) =>
        matchingSourceIds.has(review.id),
      );
      reviewsTotal = filtered.length;
      reviews = filtered.slice(reviewsOffset, reviewsOffset + reviewsLimit);
    } else {
      reviews = mapped;
      reviewsTotal = publishedCount;
    }
  }

  return {
    productId: null,
    productTitle: "All products",
    rating: averageRating,
    count: publishedCount,
    verifiedCount,
    summaryText,
    summarySourceCount: sourceReviews.length,
    summaryGeneratedAt: generatedAtIso,
    summaryMonthLabel: formatSummaryMonth(new Date(generatedAtIso)),
    summaryIsReady: true,
    highlights: enrichedHighlights,
    snippets,
    reviews,
    reviewsTotal: Number(reviewsTotal),
    reviewsOffset,
    reviewsLimit,
    hasMoreReviews: reviewsOffset + reviews.length < Number(reviewsTotal),
  } satisfies CustomerSayPayload & {
    summaryMonthLabel: string;
    summaryIsReady: boolean;
    reviews: Array<
      CustomerSayPayload["reviews"][number] & { productHandle?: string | null }
    >;
  };
}
