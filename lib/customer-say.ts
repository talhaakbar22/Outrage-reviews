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
    publishedAt?: string | null;
    createdAt?: string;
    productTitle?: string | null;
    merchantReply?: string | null;
    merchantRepliedAt?: string | null;
    replies?: Array<{
      body: string;
      authorName?: string | null;
      publishedAt?: string | null;
    }>;
    media?: Array<{
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

function formatSummaryMonth(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function isPlaceholderCustomerSummary(text: string | null | undefined) {
  const value = (text ?? "").trim().toLowerCase();
  if (!value) return true;
  if (value.includes("no verified reviews yet")) return true;
  if (value.includes("no published reviews yet")) return true;
  if (value.includes("no summary available")) return true;
  if (value.includes("loading customer summary")) return true;
  if (value.includes("no approved reviews yet") && !value.includes("shoppers")) {
    return true;
  }
  return false;
}

export function buildFallbackCustomerSummary(input: {
  productTitle?: string | null;
  reviewCount: number;
  quotes: Array<string | null | undefined>;
}) {
  const subject = input.productTitle
    ? `the ${input.productTitle}`
    : "this product";
  if (input.reviewCount <= 0) {
    return "No approved reviews yet. Once reviews are approved, a summary will appear here.";
  }

  const quotes = input.quotes
    .map((quote) => (quote ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 4);

  if (quotes.length === 0) {
    return `Customers have ${input.reviewCount} approved review${
      input.reviewCount === 1 ? "" : "s"
    } of ${subject}. Written comments will appear in this summary as soon as shoppers add them.`;
  }

  const quoted = quotes.map((quote) => `“${quote}”`).join(" ");
  return `Shoppers reviewing ${subject} mention ${quoted} Across ${
    input.reviewCount
  } approved review${input.reviewCount === 1 ? "" : "s"}.`;
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
        : "No approved reviews yet.",
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
