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

function parseSummaryPayload(raw: string): CursorReviewSummary {
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
      "You summarize ALL approved customer reviews for a Shopify product page.",
      "Include every review, even if the comment is only one or two words (for example “Nice” or “MHG”).",
      "Short reviews still count: use their star rating plus the words they wrote.",
      "If most comments are 1-2 words, still write 2-4 full sentences from those words and the ratings.",
      "Do not skip short reviews. Do not filter by verified purchase. Do not wait for longer comments.",
      "Do not use tools. Do not edit files. Reply with JSON only.",
      "JSON shape: {\"summary\":\"...\",\"highlights\":[{\"label\":\"...\",\"count\":1}]}",
      "Write 2-4 sentences in a natural merchant voice covering the overall rating and what shoppers said.",
      "Do not invent details that are not in the reviews. Do not mention AI or verified purchases.",
      `Product: ${input.productTitle}`,
      `Approved review count: ${input.reviews.length}`,
      "Reviews (rating, title, body):",
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

    return parseSummaryPayload(result.result);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
