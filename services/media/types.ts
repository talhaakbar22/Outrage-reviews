export const ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export type AllowedImageContentType = (typeof ALLOWED_IMAGE_CONTENT_TYPES)[number];

export type PresignedUpload = {
  mediaKey: string;
  uploadUrl: string;
  publicUrl: string;
  headers: Record<string, string>;
  expiresInSeconds: number;
};

export type SubmitMediaReference = {
  mediaKey: string;
  sortOrder: number;
};

export type MediaProcessingJobData = {
  reviewMediaId: string;
  pendingKey: string;
  shopId: string;
  reviewId: string;
};
