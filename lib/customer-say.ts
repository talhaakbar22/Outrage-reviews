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

export type CustomerSayViewModel = {
  productId: string | null;
  productTitle: string | null;
  rating: number | null;
  count: number;
  verifiedCount: number;
  summaryText: string;
  summarySourceCount: number;
  summaryGeneratedAt: string;
  summaryMonthLabel?: string;
  highlights: SummaryHighlight[];
  snippets: SummarySnippet[];
  reviews: Array<{
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    reviewerName: string | null;
    isVerifiedPurchase: boolean;
    publishedAt?: string | null;
    createdAt?: string;
  }>;
  reviewsTotal: number;
  reviewsOffset: number;
  reviewsLimit: number;
  hasMoreReviews: boolean;
};

function formatSummaryMonth(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function normalizeCustomerSayPayload(
  input: Record<string, unknown>,
): CustomerSayViewModel {
  const generatedAt =
    typeof input.summaryGeneratedAt === "string"
      ? input.summaryGeneratedAt
      : new Date().toISOString();

  return {
    productId: (input.productId as string | null | undefined) ?? null,
    productTitle: (input.productTitle as string | null | undefined) ?? null,
    rating:
      input.rating == null || input.rating === ""
        ? null
        : Number(input.rating),
    count: Number(input.count ?? 0),
    verifiedCount: Number(input.verifiedCount ?? 0),
    summaryText:
      typeof input.summaryText === "string"
        ? input.summaryText
        : "No published reviews yet.",
    summarySourceCount: Number(input.summarySourceCount ?? 0),
    summaryGeneratedAt: generatedAt,
    summaryMonthLabel:
      typeof input.summaryMonthLabel === "string"
        ? input.summaryMonthLabel
        : formatSummaryMonth(new Date(generatedAt)),
    highlights: Array.isArray(input.highlights)
      ? (input.highlights as SummaryHighlight[])
      : [],
    snippets: Array.isArray(input.snippets)
      ? (input.snippets as SummarySnippet[])
      : [],
    reviews: Array.isArray(input.reviews)
      ? (input.reviews as CustomerSayViewModel["reviews"])
      : [],
    reviewsTotal: Number(input.reviewsTotal ?? input.count ?? 0),
    reviewsOffset: Number(input.reviewsOffset ?? 0),
    reviewsLimit: Number(input.reviewsLimit ?? 10),
    hasMoreReviews: Boolean(input.hasMoreReviews),
  };
}
