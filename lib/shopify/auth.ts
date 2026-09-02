import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Session } from "@shopify/shopify-api";
import { getShopify, getShopifyForRequest } from "@/lib/shopify/client";
import {
  isSecureAppUrl,
  resolveRequestAppUrl,
} from "@/lib/shopify/request-origin";

export const AUTH_CALLBACK_PATH = "/api/auth/callback";

export async function beginOAuth(request: NextRequest, shop: string) {
  const appUrl = resolveRequestAppUrl(request);

  if (!isSecureAppUrl(appUrl)) {
    return NextResponse.json(
      {
        error:
          "OAuth requires HTTPS. Set SHOPIFY_APP_URL to your public https:// URL (or put nginx/Cloudflare in front of the app). HTTP dev on a raw IP will not store Shopify OAuth cookies.",
        appUrl: appUrl.toString(),
        hint: "Update Shopify Partners → App URL and redirect URL to match, then open the app using that HTTPS URL.",
      },
      { status: 400 },
    );
  }

  const shopify = getShopifyForRequest(request);

  return shopify.auth.begin({
    shop,
    callbackPath: AUTH_CALLBACK_PATH,
    isOnline: false,
    rawRequest: request,
  });
}

export async function completeOAuth(request: NextRequest) {
  const appUrl = resolveRequestAppUrl(request);

  if (!isSecureAppUrl(appUrl)) {
    throw new Error(
      `OAuth callback requires HTTPS (current origin: ${appUrl.origin}). Configure SHOPIFY_APP_URL and Shopify Partners URLs to your public HTTPS domain.`,
    );
  }

  const shopify = getShopifyForRequest(request);

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
  const appUrl = resolveRequestAppUrl(request);

  if (host && shopify.config.isEmbeddedApp) {
    return shopify.auth.buildEmbeddedAppUrl(host);
  }

  const dashboard = new URL("/dashboard", appUrl.origin);
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
