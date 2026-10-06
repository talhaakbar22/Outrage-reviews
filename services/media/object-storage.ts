import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { adminBucket } from "@/lib/firebase/admin";

function requireBucketName() {
  const bucket = env.firebaseStorageBucket();
  if (!bucket) {
    throw new Error("FIREBASE_STORAGE_BUCKET is not set");
  }
  return bucket;
}

function getBucket() {
  requireBucketName();
  return adminBucket();
}

function useUploadProxy() {
  // Emulator cannot mint real GCS signed URLs. Default elsewhere is proxy so
  // uploads work once Firebase Admin is configured (no bucket CORS required).
  if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) return true;
  if (process.env.MEDIA_UPLOAD_VIA_PROXY === "false") return false;
  return true;
}

function uploadSigningSecret() {
  return (
    process.env.MEDIA_UPLOAD_SIGNING_SECRET?.trim() ||
    process.env.SHOPIFY_API_SECRET ||
    process.env.FIREBASE_PRIVATE_KEY ||
    "local-dev-media-upload-secret"
  );
}

export function signMediaUpload(input: {
  key: string;
  contentType: string;
  expiresAt: number;
}) {
  const payload = `${input.key}\n${input.contentType}\n${input.expiresAt}`;
  return createHmac("sha256", uploadSigningSecret()).update(payload).digest("hex");
}

export function verifyMediaUploadSignature(input: {
  key: string;
  contentType: string;
  expiresAt: number;
  signature: string;
}) {
  if (!Number.isFinite(input.expiresAt) || Date.now() > input.expiresAt) {
    return false;
  }

  const expected = signMediaUpload({
    key: input.key,
    contentType: input.contentType,
    expiresAt: input.expiresAt,
  });

  try {
    const left = Buffer.from(expected, "utf8");
    const right = Buffer.from(input.signature, "utf8");
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

/** Public HTTPS URL for a Firebase Storage object (rules allow public read). */
export function buildPublicObjectUrl(key: string) {
  const bucket = requireBucketName();
  const encoded = encodeURIComponent(key);
  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;

  if (emulatorHost) {
    return `http://${emulatorHost}/v0/b/${bucket}/o/${encoded}?alt=media`;
  }

  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encoded}?alt=media`;
}

export async function createPresignedPutUrl(input: {
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number;
}) {
  void input.contentLength;
  const expiresInSeconds =
    input.expiresInSeconds ?? env.mediaPresignExpiresSeconds();

  if (useUploadProxy()) {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const signature = signMediaUpload({
      key: input.key,
      contentType: input.contentType,
      expiresAt,
    });
    const params = new URLSearchParams({
      key: input.key,
      contentType: input.contentType,
      expiresAt: String(expiresAt),
      signature,
    });
    const base = env.appUrl().toString().replace(/\/$/, "");

    return {
      uploadUrl: `${base}/api/media/direct-upload?${params.toString()}`,
      headers: {
        "Content-Type": input.contentType,
      },
      expiresInSeconds,
    };
  }

  const file = getBucket().file(input.key);
  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + expiresInSeconds * 1000,
    contentType: input.contentType,
  });

  return {
    uploadUrl,
    headers: {
      "Content-Type": input.contentType,
    },
    expiresInSeconds,
  };
}

export async function headObject(key: string) {
  const file = getBucket().file(key);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`Object not found: ${key}`);
  }

  const [metadata] = await file.getMetadata();
  return {
    contentLength: Number(metadata.size ?? 0),
    contentType: (metadata.contentType as string | undefined) ?? null,
  };
}

export async function getObjectBuffer(key: string) {
  const file = getBucket().file(key);
  const [buffer] = await file.download();
  return buffer;
}

export async function putObjectBuffer(input: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  const file = getBucket().file(input.key);
  await file.save(input.body, {
    resumable: false,
    contentType: input.contentType,
    metadata: {
      cacheControl: "public, max-age=31536000, immutable",
    },
    validation: false,
  });
}

export async function deleteObject(key: string) {
  const file = getBucket().file(key);
  await file.delete({ ignoreNotFound: true });
}
