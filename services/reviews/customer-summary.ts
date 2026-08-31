import { getDb } from "@/lib/prisma";
import { normalizeCustomerSayPayload as normalizeCustomerSayViewModel } from "@/lib/customer-say";

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

export type CustomerSayPayload = {
  productId: string | null;
  productTitle: string | null;
  rating: number | null;
  count: number;
  verifiedCount: number;
  summaryText: string;
  summarySourceCount: number;
  summaryGeneratedAt: string;
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

function buildSummaryText(
  highlights: SummaryHighlight[],
  verifiedCount: number,
  productTitle: string | null,
) {
  if (verifiedCount === 0) {
    return "No verified reviews yet. Once customers start leaving feedback, a summary will appear here.";
  }

  const subject = productTitle ? `the ${productTitle}` : "this product";
  const top = highlights.slice(0, 3);

  if (top.length === 0) {
    return `Reviewers consistently praise ${subject}. Customers highlight strong satisfaction across recent verified reviews.`;
  }

  if (top.length === 1) {
    return `Reviewers repeatedly call out ${top[0].label.toLowerCase()} when describing ${subject}. Many mention they would recommend it to others.`;
  }

  if (top.length === 2) {
    return `Reviewers repeatedly call out ${top[0].label.toLowerCase()} and ${top[1].label.toLowerCase()} when describing ${subject}. Many say it exceeded their expectations.`;
  }

  return `Reviewers repeatedly call out ${top[0].label.toLowerCase()}, ${top[1].label.toLowerCase()}, and ${top[2].label.toLowerCase()} when describing ${subject}. Many mention they would buy again.`;
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
}) {
  const db = getDb();
  const product = await db.orm.public.Product.where({
    shopId: input.shopId,
    shopifyProductId: input.shopifyProductId,
  }).first();

  if (!product) {
    return emptyPayload(input.reviewsOffset ?? 0, input.reviewsLimit ?? 10);
  }

  const sourceReviews = await db.orm.public.Review.where({
    shopId: input.shopId,
    productId: product.id,
    status: "published",
    isVerifiedPurchase: true,
  })
    .orderBy((review) => review.publishedAt.desc())
    .limit(SUMMARY_SOURCE_LIMIT)
    .all();

  const verifiedAggregate = await db.orm.public.Review.where({
    shopId: input.shopId,
    productId: product.id,
    status: "published",
    isVerifiedPurchase: true,
  }).aggregate((agg) => ({ count: agg.count() }));

  const verifiedCount = Number(verifiedAggregate?.count ?? 0);

  const bodies = sourceReviews
    .map((review) => review.body?.trim())
    .filter((body): body is string => Boolean(body));

  const highlights = buildHighlights(bodies);
  const summaryText = buildSummaryText(
    highlights,
    verifiedCount,
    product.title,
  );
  const summarySourceCount = Math.min(sourceReviews.length, SUMMARY_SOURCE_LIMIT);
  const generatedAt = new Date();

  const snippetCandidates = sourceReviews
    .filter((review) => review.body && review.rating >= 4)
    .slice(0, 40);

  const snippets: SummarySnippet[] = snippetCandidates
    .slice(0, SNIPPET_LIMIT)
    .map((review) => ({
      id: review.id,
      quote: firstSentence(review.body ?? ""),
      reviewerName: review.reviewerName,
      rating: review.rating,
      isVerifiedPurchase: review.isVerifiedPurchase,
    }));

  let reviews: CustomerSayPayload["reviews"] = [];
  let reviewsTotal = product.reviewCount;
  const reviewsOffset = input.reviewsOffset ?? 0;
  const reviewsLimit = Math.min(input.reviewsLimit ?? 10, 50);

  if (input.includeReviews) {
    const rows = await db.orm.public.Review.where({
      shopId: input.shopId,
      productId: product.id,
      status: "published",
    })
      .orderBy((review) => review.publishedAt.desc())
      .offset(reviewsOffset)
      .limit(reviewsLimit)
      .all();

    reviews = rows.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      reviewerName: review.reviewerName,
      isVerifiedPurchase: review.isVerifiedPurchase,
      publishedAt: review.publishedAt?.toISOString() ?? null,
      createdAt: review.createdAt.toISOString(),
    }));

    reviewsTotal = product.reviewCount;
  }

  const existingSummary = await db.orm.public.AiSummary.where({
    shopId: input.shopId,
    productId: product.id,
  }).first();

  const summaryRecord = {
    summaryText,
    highlights,
    sentimentScore:
      product.avgRating != null ? product.avgRating / 5 : null,
    modelVersion: "heuristic-v1",
    generatedAt,
  };

  if (existingSummary) {
    await db.orm.public.AiSummary.where({ id: existingSummary.id }).update({
      summaryText: summaryRecord.summaryText,
      highlights: summaryRecord.highlights,
      sentimentScore: summaryRecord.sentimentScore,
      modelVersion: summaryRecord.modelVersion,
      generatedAt: summaryRecord.generatedAt,
    });
  } else if (verifiedCount > 0) {
    await db.orm.public.AiSummary.create({
      shopId: input.shopId,
      productId: product.id,
      ...summaryRecord,
    });
  }

  return {
    productId: product.id,
    productTitle: product.title,
    rating: product.avgRating != null ? Number(product.avgRating) : null,
    count: Number(product.reviewCount),
    verifiedCount,
    summaryText,
    summarySourceCount,
    summaryGeneratedAt: generatedAt.toISOString(),
    summaryMonthLabel: formatSummaryMonth(generatedAt),
    highlights,
    snippets,
    reviews,
    reviewsTotal: Number(reviewsTotal),
    reviewsOffset,
    reviewsLimit,
    hasMoreReviews:
      reviewsOffset + reviews.length < Number(reviewsTotal),
  } satisfies CustomerSayPayload & { summaryMonthLabel: string };
}

export function emptyPayload(
  offset: number,
  limit: number,
  overrides: Partial<
    CustomerSayPayload & { summaryMonthLabel: string }
  > = {},
): CustomerSayPayload & { summaryMonthLabel: string } {
  const generatedAt = new Date();
  return {
    productId: null,
    productTitle: null,
    rating: null,
    count: 0,
    verifiedCount: 0,
    summaryText:
      "No published reviews yet. Once customers start leaving feedback, a summary will appear here.",
    summarySourceCount: 0,
    summaryGeneratedAt: generatedAt.toISOString(),
    summaryMonthLabel: formatSummaryMonth(generatedAt),
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
    reviews: normalized.reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      reviewerName: review.reviewerName,
      isVerifiedPurchase: review.isVerifiedPurchase,
      publishedAt: review.publishedAt ?? null,
      createdAt: review.createdAt ?? new Date().toISOString(),
    })),
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
