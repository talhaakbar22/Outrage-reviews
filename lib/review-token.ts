import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const TOKEN_BYTE_LENGTH = 32;

export function generateReviewToken() {
  const rawToken = randomBytes(TOKEN_BYTE_LENGTH).toString("base64url");
  return {
    rawToken,
    tokenHash: hashReviewToken(rawToken),
  };
}

export function hashReviewToken(rawToken: string) {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function isValidReviewTokenFormat(rawToken: string) {
  return /^[A-Za-z0-9_-]{40,64}$/.test(rawToken);
}

export function tokensMatch(rawToken: string, tokenHash: string) {
  const computed = hashReviewToken(rawToken);
  const left = Buffer.from(computed, "utf8");
  const right = Buffer.from(tokenHash, "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function buildReviewRequestUrl(rawToken: string) {
  return new URL(`/review/${rawToken}`, env.appUrl()).toString();
}
