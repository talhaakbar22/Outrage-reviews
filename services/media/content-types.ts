import type { AllowedImageContentType } from "@/services/media/types";
import { extensionForContentType } from "@/services/media/keys";

export const ALLOWED_VIDEO_CONTENT_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export type AllowedVideoContentType = (typeof ALLOWED_VIDEO_CONTENT_TYPES)[number];

export type AllowedMediaContentType =
  | AllowedImageContentType
  | AllowedVideoContentType;

export function extensionForMediaContentType(contentType: AllowedMediaContentType) {
  if (contentType.startsWith("video/")) {
    const map: Record<AllowedVideoContentType, string> = {
      "video/mp4": "mp4",
      "video/quicktime": "mov",
      "video/webm": "webm",
    };
    return map[contentType as AllowedVideoContentType];
  }

  return extensionForContentType(contentType as AllowedImageContentType);
}

export function mediaKindForContentType(contentType: string): "image" | "video" {
  return contentType.startsWith("video/") ? "video" : "image";
}

export function assertAllowedMediaContentType(
  contentType: string,
): asserts contentType is AllowedMediaContentType {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "video/mp4",
    "video/quicktime",
    "video/webm",
  ];

  if (!allowed.includes(contentType)) {
    throw new Error("Unsupported file type");
  }
}
