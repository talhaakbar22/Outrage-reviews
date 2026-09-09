import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "@/lib/env";

export type AiReviewTheme = {
  label: string;
  count: number;
};

export type CursorReviewSummary = {
  summary: string;
  highlights: AiReviewTheme[];
};

const MODEL_ID = "composer-2.5";
const SUMMARY_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("AI summary timed out"));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function summaryCopiesReviewWording(
  summary: string,
  reviews: Array<{ title: string | null; body: string | null }>,
) {
  const haystack = summary.toLowerCase();
  if (/[“"][^”"]{3,}[”"]/.test(summary)) return true;
  if (
    haystack.includes("customers have left") &&
    haystack.includes("approved review")
  ) {
    return true;
  }

  return reviews.some((review) => {
    const phrases = [review.body, review.title]
      .map((value) => (value ?? "").replace(/\s+/g, " ").trim().toLowerCase())
      .filter((value) => value.length >= 8);
    return phrases.some((phrase) => haystack.includes(phrase));
  });
}

function parseSummaryPayload(
  raw: string,
  reviews: Array<{ title: string | null; body: string | null }>,
): CursorReviewSummary {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("AI summary did not return JSON");
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
    summary?: unknown;
    highlights?: unknown;
  };
  const summary = String(parsed.summary ?? "").replace(/\s+/g, " ").trim();
  if (summary.length < 20) {
    throw new Error("AI summary was empty");
  }
  if (summaryCopiesReviewWording(summary, reviews)) {
    throw new Error("AI summary copied review wording");
  }

  const highlights = Array.isArray(parsed.highlights)
    ? parsed.highlights
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as { label?: unknown; count?: unknown };
          const label = String(row.label ?? "").trim();
          const count = Number(row.count ?? 0);
          if (!label) return null;
          return { label, count: Number.isFinite(count) ? count : 0 };
        })
        .filter((item): item is AiReviewTheme => Boolean(item))
        .slice(0, 5)
    : [];

  return { summary, highlights };
}

export async function generateCursorReviewSummary(input: {
  productTitle: string;
  reviews: Array<{
    rating: number;
    title: string | null;
    body: string | null;
  }>;
}): Promise<CursorReviewSummary> {
  const apiKey = env.cursorApiKey();
  if (!apiKey) {
    throw new Error("CURSOR_API_KEY is not set");
  }

  const workspace = await mkdtemp(join(tmpdir(), "outrage-summary-"));
  try {
    await writeFile(join(workspace, ".gitkeep"), "", "utf8");

    const prompt = [
      "You write a short product-page summary of ALL approved customer reviews.",
      "Output 1 to 3 complete sentences only (about one to three lines). Natural merchant voice.",
      "Treat review words as keywords and themes. Write your own sentences. Never copy, paste, or quote customer wording.",
      "Do not put review text in quotation marks. Do not list comments. Do not repeat phrases like “Nice product”.",
      "One or two word reviews still count: use the star rating plus the idea behind the words (for example praise, repurchase, mixed feelings).",
      "Ignore nonsense or acronym-only comments except for their star rating.",
      "Do not skip short reviews. Do not filter by verified purchase.",
      "Do not invent features, materials, or stories that are not implied by the ratings and keywords.",
      "Do not mention how many reviews there are, approved counts, or the product title in a sentence like “Customers have left 4 approved reviews of the Gift Card”.",
      "Do not start with a review-count opener. Write only what shoppers felt.",
      "Do not use tools. Do not edit files. Reply with JSON only.",
      "JSON shape: {\"summary\":\"...\",\"highlights\":[{\"label\":\"...\",\"count\":1}]}",
      `Product: ${input.productTitle}`,
      `Approved review count: ${input.reviews.length}`,
      "Reviews (rating, title, body) — keywords only, do not quote these back:",
      JSON.stringify(
        input.reviews.map((review, index) => ({
          n: index + 1,
          rating: review.rating,
          title: review.title || "",
          body: review.body || "",
        })),
      ),
    ].join("\n");

    const { Agent } = await import("@cursor/sdk");
    const result = await withTimeout(
      Agent.prompt(prompt, {
        apiKey,
        model: { id: MODEL_ID },
        local: { cwd: workspace, settingSources: [] },
        tools: [],
      }),
      SUMMARY_TIMEOUT_MS,
    );

    if (result.status !== "finished" || !result.result) {
      const details =
        result.error &&
        typeof result.error === "object" &&
        "message" in result.error
          ? String((result.error as { message?: unknown }).message ?? "")
          : "";
      throw new Error(details || "AI summary failed");
    }

    return parseSummaryPayload(result.result, input.reviews);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
