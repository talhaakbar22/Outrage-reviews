import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import {
  assertAllowedMediaContentType,
  extensionForMediaContentType,
} from "@/services/media/content-types";
import {
  ALLOWED_IMAGE_CONTENT_TYPES,
  type AllowedImageContentType,
  type PresignedUpload,
} from "@/services/media/types";
import { buildPendingUploadKey } from "@/services/media/keys";
import {
  buildPublicObjectUrl,
  createPresignedPutUrl,
} from "@/services/media/object-storage";

function assertAllowedContentType(
  contentType: string,
): asserts contentType is AllowedImageContentType {
  if (!ALLOWED_IMAGE_CONTENT_TYPES.includes(contentType as AllowedImageContentType)) {
    throw new Error("Only JPEG, PNG, WebP, GIF, or AVIF images are allowed");
  }
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

function buildPendingMediaKey(input: {
  shopId: string;
  ownerId: string;
  contentType: string;
}) {
  assertAllowedMediaContentType(input.contentType);
  const extension = extensionForMediaContentType(input.contentType);
  const uploadId = randomBytes(16).toString("hex");

  return [
    "pending",
    sanitizeSegment(input.shopId),
    sanitizeSegment(input.ownerId),
    `${uploadId}.${extension}`,
  ].join("/");
}

async function createUploadPermission(input: {
  shopId: string;
  ownerId: string;
  contentType: string;
  contentLength: number;
}): Promise<PresignedUpload> {
  const maxBytes = env.mediaUploadMaxBytes();
  if (
    !Number.isFinite(input.contentLength) ||
    input.contentLength < 1 ||
    input.contentLength > maxBytes
  ) {
    throw new Error(`Each file must be between 1 byte and ${maxBytes} bytes`);
  }

  const mediaKey = buildPendingMediaKey(input);

  const presigned = await createPresignedPutUrl({
    key: mediaKey,
    contentType: input.contentType,
    contentLength: input.contentLength,
  });

  return {
    mediaKey,
    uploadUrl: presigned.uploadUrl,
    publicUrl: buildPublicObjectUrl(mediaKey),
    headers: presigned.headers,
    expiresInSeconds: presigned.expiresInSeconds,
  };
}

export async function createReviewUploadPermission(input: {
  shopId: string;
  requestId: string;
  contentType: string;
  contentLength: number;
}): Promise<PresignedUpload> {
  assertAllowedContentType(input.contentType);

  const maxBytes = env.mediaUploadMaxBytes();
  if (
    !Number.isFinite(input.contentLength) ||
    input.contentLength < 1 ||
    input.contentLength > maxBytes
  ) {
    throw new Error(`Each image must be between 1 byte and ${maxBytes} bytes`);
  }

  const mediaKey = buildPendingUploadKey({
    shopId: input.shopId,
    requestId: input.requestId,
    contentType: input.contentType,
  });

  const presigned = await createPresignedPutUrl({
    key: mediaKey,
    contentType: input.contentType,
    contentLength: input.contentLength,
  });

  return {
    mediaKey,
    uploadUrl: presigned.uploadUrl,
    publicUrl: buildPublicObjectUrl(mediaKey),
    headers: presigned.headers,
    expiresInSeconds: presigned.expiresInSeconds,
  };
}

export async function createWidgetUploadPermission(input: {
  shopId: string;
  uploadSessionId: string;
  contentType: string;
  contentLength: number;
}): Promise<PresignedUpload & { mediaType: "image" | "video" }> {
  const upload = await createUploadPermission({
    shopId: input.shopId,
    ownerId: input.uploadSessionId,
    contentType: input.contentType,
    contentLength: input.contentLength,
  });

  return {
    ...upload,
    mediaType: input.contentType.startsWith("video/") ? "video" : "image",
  };
}
