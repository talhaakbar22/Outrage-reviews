export type SummaryHighlight = {
  label: string;
  count: number;
  reviewIds?: string[];
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
  if (value.includes("mention “") || value.includes('mention "')) return true;
  if (
    value.includes("customers have left") &&
    value.includes("approved review")
  ) {
    return true;
  }
  return false;
}

const KEYWORD_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "for",
  "in",
  "on",
  "it",
  "is",
  "was",
  "i",
  "me",
  "my",
  "we",
  "you",
  "this",
  "that",
  "with",
  "very",
  "just",
  "one",
  "would",
  "like",
  "really",
]);

function averageReviewTone(ratings: number[]) {
  if (ratings.length === 0) return "positive";
  const avg =
    ratings.reduce((total, rating) => total + rating, 0) / ratings.length;
  if (avg >= 4.5) return "very positive";
  if (avg >= 3.5) return "positive";
  if (avg >= 2.5) return "mixed";
  return "critical";
}

function extractSummaryKeywords(texts: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const tokens = (text ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/);
    for (const token of tokens) {
      if (token.length < 3) continue;
      if (KEYWORD_STOPWORDS.has(token)) continue;
      if (!/[aeiou]/.test(token)) continue;
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([token]) => token);
}

function themeSentence(keywords: string[]) {
  const hasPraise = keywords.some((word) =>
    /nice|good|great|love|excellent|amazing/.test(word),
  );
  const hasRepurchase = keywords.some((word) =>
    /buy|again|repeat|return/.test(word),
  );
  const hasGift = keywords.some((word) => /gift|present/.test(word));

  if (hasPraise && hasRepurchase) {
    return "The short comments point to a likeable product that some shoppers would purchase again.";
  }
  if (hasPraise) {
    return "The short comments point to a likeable product, even when people only leave a word or two.";
  }
  if (hasRepurchase) {
    return "A recurring theme is that some shoppers would come back for another purchase.";
  }
  if (hasGift) {
    return "Gift-giving comes up as a theme, more than a long product breakdown.";
  }
  if (keywords.length > 0) {
    return "The written comments are brief, so this summary follows the ratings and a few repeated themes rather than copying what people typed.";
  }
  return "Most comments are very short, so this summary follows the star ratings more than detailed write-ups.";
}

function toneSentence(tone: string) {
  if (tone === "very positive") {
    return "Shoppers are enthusiastic overall.";
  }
  if (tone === "positive") {
    return "Shoppers are generally pleased.";
  }
  if (tone === "mixed") {
    return "Shopper feedback is mixed overall.";
  }
  return "Shopper feedback is more cautious overall.";
}

export function buildFallbackCustomerSummary(input: {
  productTitle?: string | null;
  reviewCount: number;
  quotes: Array<string | null | undefined>;
  ratings?: number[];
}) {
  if (input.reviewCount <= 0) {
    return "No approved reviews yet. Once reviews are approved, a summary will appear here.";
  }

  const tone = averageReviewTone(input.ratings ?? []);
  const keywords = extractSummaryKeywords(input.quotes);
  const lines = [toneSentence(tone), themeSentence(keywords)];

  if (tone === "mixed" || tone === "critical") {
    lines.push(
      "A few scores are more reserved, so the picture is useful rather than perfect.",
    );
  }

  return lines.slice(0, 3).join(" ");
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
