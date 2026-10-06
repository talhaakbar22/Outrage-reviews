import { randomBytes } from "node:crypto";
import type { AllowedImageContentType } from "@/services/media/types";

const CONTENT_TYPE_EXTENSION: Record<AllowedImageContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

export function extensionForContentType(contentType: AllowedImageContentType) {
  return CONTENT_TYPE_EXTENSION[contentType];
}

/** Pending browser uploads before processing. */
export function buildPendingUploadKey(input: {
  shopId: string;
  requestId: string;
  contentType: AllowedImageContentType;
}) {
  const uploadId = randomBytes(16).toString("hex");
  const extension = extensionForContentType(input.contentType);

  return [
    "review-media",
    sanitizeSegment(input.shopId),
    "pending",
    sanitizeSegment(input.requestId),
    `${uploadId}.${extension}`,
  ].join("/");
}

/** Processed review images in Firebase Storage. */
export function buildProcessedMediaKeys(input: {
  shopId: string;
  reviewId: string;
  reviewMediaId: string;
}) {
  const prefix = [
    "review-media",
    sanitizeSegment(input.shopId),
    sanitizeSegment(input.reviewId),
    sanitizeSegment(input.reviewMediaId),
  ].join("/");

  return {
    fullKey: `${prefix}/full.webp`,
    thumbKey: `${prefix}/thumb.webp`,
  };
}

export function assertPendingUploadKey(key: string, shopId: string, requestId: string) {
  const expectedPrefix = `review-media/${sanitizeSegment(shopId)}/pending/${sanitizeSegment(requestId)}/`;
  if (!key.startsWith(expectedPrefix)) {
    throw new Error("Invalid media key for this review request");
  }

  if (key.includes("..")) {
    throw new Error("Invalid media key");
  }
}
