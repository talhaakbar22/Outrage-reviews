import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

const IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function extensionForContentType(contentType: string | null, sourceUrl: string) {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/avif":
      return "avif";
    default: {
      const fromUrl = sourceUrl.split("?")[0]?.split(".").pop()?.toLowerCase();
      if (fromUrl && ["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(fromUrl)) {
        return fromUrl === "jpeg" ? "jpg" : fromUrl;
      }
      return "jpg";
    }
  }
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

export function buildReviewMediaStorageKey(
  shopId: string,
  reviewExternalId: string,
  index: number,
  extension: string,
) {
  const hash = createHash("sha256")
    .update(`${reviewExternalId}:${index}`)
    .digest("hex")
    .slice(0, 16);

  return path.posix.join(
    "reviews",
    sanitizeSegment(shopId),
    sanitizeSegment(reviewExternalId),
    `${index}-${hash}.${extension}`,
  );
}

export function resolveStoredMediaPath(storageKey: string) {
  const root = path.resolve(env.storageRoot());
  const absolute = path.resolve(root, storageKey);

  if (!absolute.startsWith(`${root}${path.sep}`) && absolute !== root) {
    throw new Error("Invalid media storage key");
  }

  return absolute;
}

export function buildPublicMediaUrl(storageKey: string) {
  return `${env.storagePublicBaseUrl()}/${storageKey.split(path.posix.sep).map(encodeURIComponent).join("/")}`;
}

export async function downloadReviewImage(input: {
  shopId: string;
  reviewExternalId: string;
  sourceUrl: string;
  index: number;
}) {
  const response = await fetch(input.sourceUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to download image (${response.status})`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0] ?? null;
  if (contentType && !IMAGE_CONTENT_TYPES.has(contentType)) {
    throw new Error(`Unsupported image content type: ${contentType}`);
  }

  const extension = extensionForContentType(contentType, input.sourceUrl);
  const storageKey = buildReviewMediaStorageKey(
    input.shopId,
    input.reviewExternalId,
    input.index,
    extension,
  );
  const absolutePath = resolveStoredMediaPath(storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error("Downloaded image was empty");
  }

  await writeFile(absolutePath, buffer);

  return {
    storageKey,
    publicUrl: buildPublicMediaUrl(storageKey),
    contentType,
    byteSize: buffer.length,
  };
}
