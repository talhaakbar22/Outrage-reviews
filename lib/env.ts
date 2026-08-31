function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function appUrl(): URL {
  const raw =
    process.env.SHOPIFY_APP_URL ??
    process.env.HOST ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

  if (!raw) {
    throw new Error("SHOPIFY_APP_URL (or HOST / VERCEL_URL) is not set");
  }

  return new URL(raw.endsWith("/") ? raw : `${raw}/`);
}

export const env = {
  shopifyApiKey: () => required("SHOPIFY_API_KEY"),
  shopifyApiSecret: () => required("SHOPIFY_API_SECRET"),
  databaseUrl: () => required("DATABASE_URL"),
  appUrl,
  appHost: () => {
    const url = appUrl();
    return url.host;
  },
  appScheme: () => {
    const url = appUrl();
    return url.protocol.replace(":", "") as "http" | "https";
  },
  isEmbeddedApp: () => process.env.SHOPIFY_EMBEDDED !== "false",
  redisUrl: () => process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  skipBackgroundQueue: () => process.env.SKIP_BACKGROUND_QUEUE === "true",
  storageRoot: () => process.env.STORAGE_ROOT ?? "storage",
  storagePublicBaseUrl: () => {
    const base =
      process.env.STORAGE_PUBLIC_BASE_URL ??
      `${process.env.SHOPIFY_APP_URL ?? "http://localhost:3000"}/api/media`;
    return base.endsWith("/") ? base.slice(0, -1) : base;
  },
  s3Bucket: () => required("S3_BUCKET"),
  s3Region: () => process.env.S3_REGION ?? "auto",
  s3Endpoint: () => process.env.S3_ENDPOINT,
  s3AccessKeyId: () => required("S3_ACCESS_KEY_ID"),
  s3SecretAccessKey: () => required("S3_SECRET_ACCESS_KEY"),
  s3PublicBaseUrl: () => {
    const base = required("S3_PUBLIC_BASE_URL");
    return base.endsWith("/") ? base.slice(0, -1) : base;
  },
  s3ForcePathStyle: () => process.env.S3_FORCE_PATH_STYLE === "true",
  mediaUploadMaxBytes: () =>
    Number(process.env.MEDIA_UPLOAD_MAX_BYTES ?? 5 * 1024 * 1024),
  mediaPresignExpiresSeconds: () =>
    Number(process.env.MEDIA_PRESIGN_EXPIRES_SECONDS ?? 900),
  emailProvider: (): "console" | "resend" => {
    const value = (process.env.EMAIL_PROVIDER ?? "console").toLowerCase();
    return value === "resend" ? "resend" : "console";
  },
  resendApiKey: () => required("RESEND_API_KEY"),
  emailFrom: () =>
    process.env.EMAIL_FROM ?? "Outrage Reviews <onboarding@resend.dev>",
  /** Optional ms override for local testing (skips day-based delays). */
  reviewRequestDelayMs: () => {
    const raw = process.env.REVIEW_REQUEST_DELAY_MS;
    return raw ? Number(raw) : null;
  },
  reviewReminderDelayMs: () => {
    const raw = process.env.REVIEW_REMINDER_DELAY_MS;
    return raw ? Number(raw) : null;
  },
};
