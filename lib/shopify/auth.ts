import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Session } from "@shopify/shopify-api";
import { getShopify, getShopifyForRequest } from "@/lib/shopify/client";
import {
  isSecureAppUrl,
  resolveRequestAppUrl,
} from "@/lib/shopify/request-origin";

export const AUTH_CALLBACK_PATH = "/api/auth/callback";

/**
 * OAuth must run at the top browser level. Nested inside admin.shopify.com
 * the authorize page is blocked (`refused to connect`) and the state cookie
 * is often missing — which breaks installs on every new store.
 */
export function needsTopLevelOAuth(request: NextRequest) {
  if (request.nextUrl.searchParams.get("top_level") === "1") {
    return false;
  }

  const host = request.nextUrl.searchParams.get("host");
  const embedded = request.nextUrl.searchParams.get("embedded");
  const secFetchDest = request.headers.get("sec-fetch-dest");

  return Boolean(host) || embedded === "1" || secFetchDest === "iframe";
}

/** HTML bounce that reloads /api/auth in window.top before starting OAuth. */
export function topLevelOAuthBounce(request: NextRequest) {
  const appUrl = resolveRequestAppUrl(request);
  const bounce = new URL("/api/auth", appUrl.origin);
  request.nextUrl.searchParams.forEach((value, key) => {
    bounce.searchParams.set(key, value);
  });
  bounce.searchParams.set("top_level", "1");

  const target = bounce.toString();
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Installing Outrage Reviews…</title>
    <script>
      window.top.location.href = ${JSON.stringify(target)};
    </script>
  </head>
  <body>
    <p>Continue installing Outrage Reviews…</p>
    <p><a href=${JSON.stringify(target)} target="_top">Click here if you are not redirected</a></p>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "frame-ancestors https://*.myshopify.com https://admin.shopify.com;",
      "Cache-Control": "no-store",
    },
  });
}

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

  if (needsTopLevelOAuth(request)) {
    return topLevelOAuthBounce(request);
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
