import sharp from "sharp";
import { getDb } from "@/lib/prisma";
import { buildProcessedMediaKeys } from "@/services/media/keys";
import type { MediaProcessingJobData } from "@/services/media/types";
import {
  buildPublicObjectUrl,
  deleteObject,
  getObjectBuffer,
  putObjectBuffer,
} from "@/services/media/object-storage";

const MAX_IMAGE_DIMENSION = 4000;
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

export async function processReviewMedia(job: MediaProcessingJobData) {
  const source = await getObjectBuffer(job.pendingKey);

  if (source.length === 0) {
    throw new Error("Uploaded image was empty");
  }

  if (source.length > MAX_SOURCE_BYTES) {
    throw new Error("Uploaded image exceeds the maximum allowed size");
  }

  const metadata = await sharp(source).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Uploaded file is not a valid image");
  }

  if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
    throw new Error(
      `Image dimensions must be ${MAX_IMAGE_DIMENSION}px or smaller on each side`,
    );
  }

  const fullBuffer = await sharp(source)
    .rotate()
    .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  const thumbBuffer = await sharp(source)
    .rotate()
    .resize(400, 400, { fit: "cover" })
    .webp({ quality: 80 })
    .toBuffer();

  const processedKeys = buildProcessedMediaKeys({
    shopId: job.shopId,
    reviewId: job.reviewId,
    reviewMediaId: job.reviewMediaId,
  });

  await putObjectBuffer({
    key: processedKeys.fullKey,
    body: fullBuffer,
    contentType: "image/webp",
  });

  await putObjectBuffer({
    key: processedKeys.thumbKey,
    body: thumbBuffer,
    contentType: "image/webp",
  });

  const db = getDb();
  await db.orm.public.ReviewMedia.where({ id: job.reviewMediaId }).update({
    url: buildPublicObjectUrl(processedKeys.fullKey),
    thumbnailUrl: buildPublicObjectUrl(processedKeys.thumbKey),
  });

  try {
    await deleteObject(job.pendingKey);
  } catch (error) {
    console.warn(`Failed to delete pending object ${job.pendingKey}:`, error);
  }
}
