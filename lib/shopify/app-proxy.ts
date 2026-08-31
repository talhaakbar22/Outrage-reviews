import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Verify Shopify App Proxy query signature.
 * @see https://shopify.dev/docs/apps/build/online-store/display-merchant-data/app-proxies
 */
export function verifyAppProxySignature(
  searchParams: URLSearchParams,
): boolean {
  const signature = searchParams.get("signature");
  if (!signature) {
    return false;
  }

  const entries: string[] = [];
  for (const [key, value] of searchParams.entries()) {
    if (key === "signature") continue;
    entries.push(`${key}=${value}`);
  }
  entries.sort();

  const message = entries.join("");
  const digest = createHmac("sha256", env.shopifyApiSecret())
    .update(message)
    .digest("hex");

  try {
    const left = Buffer.from(digest, "utf8");
    const right = Buffer.from(signature, "utf8");
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function normalizeProxyShopDomain(shop: string | null) {
  if (!shop) return null;
  const trimmed = shop.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
}
