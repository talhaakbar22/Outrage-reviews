export type HighlightReviewRef = {
  id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
};

export type SummaryHighlight = {
  label: string;
  count: number;
  reviewIds?: string[];
};

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

/** Extra matchers for common AI-written highlight labels. */
const LABEL_PATTERN_ALIASES: Array<{ match: RegExp; patterns: RegExp[]; minRating?: number }> = [
  {
    match: /strong\s+enthusiasm|very\s+enthusias|love\s+it|loved\s+it/i,
    patterns: [
      /\b(omg|love[d]?|amazing|fantastic|awesome|wonderful|perfect|excellent|thrilled|so happy)\b/i,
      /!{2,}/,
    ],
    minRating: 5,
  },
  {
    match: /positive\s+overall|overall\s+impression|generally\s+positive|positive\s+feedback/i,
    patterns: [
      /\b(nice|good|great|happy|pleased|satisfied|positive|recommend|like[sd]?)\b/i,
    ],
    minRating: 4,
  },
  {
    match: /would\s+buy\s+again|buy\s+again|repurchase|come\s+back/i,
    patterns: [
      /buy\s+again/i,
      /purchase\s+again/i,
      /order\s+again/i,
      /come\s+back/i,
      /repurchase/i,
      /will\s+buy/i,
      /definitely\s+buy/i,
    ],
  },
  {
    match: /recommend|recommendation/i,
    patterns: [/recommend/i, /highly\s+suggest/i],
  },
  {
    match: /value\s+for\s+money|worth\s+the\s+(money|price)|great\s+value/i,
    patterns: [/value/i, /worth/i, /price/i, /affordable/i, /bargain/i],
  },
  {
    match: /fast\s+(delivery|shipping)|quick\s+(delivery|shipping)/i,
    patterns: [/delivery/i, /shipping/i, /arrived/i, /fast/i, /quick/i],
  },
  {
    match: /gift|present/i,
    patterns: [/gift/i, /present/i, /birthday/i, /christmas/i, /anniversary/i],
  },
];

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "overall",
  "impression",
  "feedback",
  "customers",
  "customer",
  "review",
  "reviews",
  "shoppers",
  "product",
]);

function reviewText(review: HighlightReviewRef) {
  return `${review.title ?? ""} ${review.body ?? ""}`.replace(/\s+/g, " ").trim();
}

function patternsForLabel(label: string): { patterns: RegExp[]; minRating?: number } {
  const exact = THEME_PATTERNS.find(
    (theme) => theme.label.toLowerCase() === label.trim().toLowerCase(),
  );
  if (exact) return { patterns: exact.patterns };

  for (const alias of LABEL_PATTERN_ALIASES) {
    if (alias.match.test(label)) {
      return { patterns: alias.patterns, minRating: alias.minRating };
    }
  }

  const tokens = label
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));

  if (tokens.length === 0) return { patterns: [] };

  return {
    patterns: tokens.map((token) => new RegExp(`\\b${escapeRegExp(token)}\\b`, "i")),
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function reviewMatchesHighlight(
  review: HighlightReviewRef,
  label: string,
): boolean {
  const { patterns, minRating } = patternsForLabel(label);
  const text = reviewText(review);
  const rating = Number(review.rating) || 0;

  if (patterns.length === 0) {
    return minRating != null ? rating >= minRating : false;
  }

  const textHit = patterns.some((pattern) => pattern.test(text));
  if (textHit) return true;

  // Soft fallback for enthusiasm / positive badges with little text.
  if (minRating != null && rating >= minRating && text.length > 0 && text.length <= 40) {
    return true;
  }

  return false;
}

export function collectReviewIdsForHighlight(
  label: string,
  reviews: HighlightReviewRef[],
): string[] {
  return reviews
    .filter((review) => reviewMatchesHighlight(review, label))
    .map((review) => review.id);
}

export function enrichHighlightsWithReviewIds(
  highlights: Array<{ label: string; count: number; reviewIds?: string[] }>,
  reviews: HighlightReviewRef[],
): SummaryHighlight[] {
  return highlights.map((item) => {
    const reviewIds =
      item.reviewIds && item.reviewIds.length > 0
        ? item.reviewIds
        : collectReviewIdsForHighlight(item.label, reviews);
    return {
      label: item.label,
      count: Math.max(item.count, reviewIds.length) || item.count,
      reviewIds,
    };
  });
}

export function buildHeuristicHighlights(
  reviews: HighlightReviewRef[],
): SummaryHighlight[] {
  const bodies = reviews
    .map((review) => reviewText(review))
    .filter((body) => body.length > 0);

  return THEME_PATTERNS.map((theme) => {
    const reviewIds = reviews
      .filter((review) =>
        theme.patterns.some((pattern) => pattern.test(reviewText(review))),
      )
      .map((review) => review.id);
    return {
      label: theme.label,
      count: reviewIds.length,
      reviewIds,
    };
  })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export { THEME_PATTERNS };
