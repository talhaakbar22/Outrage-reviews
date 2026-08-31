import { env } from "@/lib/env";
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
