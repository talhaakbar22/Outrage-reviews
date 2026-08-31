import type { NextRequest } from "next/server";
import type { Session } from "@shopify/shopify-api";
import { env } from "@/lib/env";
import { getShopify } from "@/lib/shopify/client";

export const AUTH_CALLBACK_PATH = "/api/auth/callback";

export async function beginOAuth(request: NextRequest, shop: string) {
  const shopify = getShopify();

  return shopify.auth.begin({
    shop,
    callbackPath: AUTH_CALLBACK_PATH,
    isOnline: false,
    rawRequest: request,
  });
}

export async function completeOAuth(request: NextRequest) {
  const shopify = getShopify();

  return shopify.auth.callback({
    rawRequest: request,
  }) as Promise<{
    session: Session;
    headers: Headers;
  }>;
}

export function buildPostAuthRedirectUrl(request: NextRequest, shop: string) {
  const shopify = getShopify();
  const host = request.nextUrl.searchParams.get("host");

  if (host && shopify.config.isEmbeddedApp) {
    return shopify.auth.buildEmbeddedAppUrl(host);
  }

  const dashboard = new URL("/dashboard", env.appUrl().origin);
  dashboard.searchParams.set("shop", shop);
  if (host) {
    dashboard.searchParams.set("host", host);
  }
  return dashboard.toString();
}

export function normalizeShopDomain(shop: string) {
  const trimmed = shop.trim().toLowerCase();
  if (trimmed.endsWith(".myshopify.com")) {
    return trimmed;
  }
  return `${trimmed.replace(/\.myshopify\.com$/, "")}.myshopify.com`;
}
