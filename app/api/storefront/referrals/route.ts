import { NextRequest, NextResponse } from "next/server";
import {
  normalizeProxyShopDomain,
  verifyAppProxySignature,
} from "@/lib/shopify/app-proxy";
import { getShopByDomain } from "@/services/storefront/reviews";
import {
  buildReferralPublicPayload,
  type AdvocateSource,
} from "@/services/referrals/engine";
import type { ReferralWidgetId } from "@/services/referrals/settings";

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  };
}

function verifyProxy(params: URLSearchParams) {
  return !params.has("signature") || verifyAppProxySignature(params);
}

const WIDGETS: ReferralWidgetId[] = [
  "onsite_popup",
  "onsite_sidebar",
  "post_purchase",
  "post_purchase_legacy",
  "post_review",
];

function asWidget(value: string | null): ReferralWidgetId {
  if (value && WIDGETS.includes(value as ReferralWidgetId)) {
    return value as ReferralWidgetId;
  }
  return "onsite_popup";
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

/**
 * App proxy: GET /apps/outrage-reviews/referrals
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const params = request.nextUrl.searchParams;

  if (!verifyProxy(params)) {
    return NextResponse.json(
      { error: "Invalid proxy signature" },
      { status: 401, headers: corsHeaders(origin) },
    );
  }

  const shopDomain = normalizeProxyShopDomain(params.get("shop"));
  if (!shopDomain) {
    return NextResponse.json(
      { error: "shop is required" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  const shop = await getShopByDomain(shopDomain);
  if (!shop || shop.uninstalledAt) {
    return NextResponse.json(
      { error: "Shop not found" },
      { status: 404, headers: corsHeaders(origin) },
    );
  }

  const widget = asWidget(params.get("widget"));
  const payload = await buildReferralPublicPayload({
    shopId: shop.id,
    shopDomain,
    widget,
  });

  return NextResponse.json(
    { ok: true, ...payload },
    { headers: corsHeaders(origin) },
  );
}

/**
 * App proxy: POST /apps/outrage-reviews/referrals
 * actions: signup | redeem
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const params = request.nextUrl.searchParams;

  if (!verifyProxy(params)) {
    return NextResponse.json(
      { error: "Invalid proxy signature" },
      { status: 401, headers: corsHeaders(origin) },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const shopDomain = normalizeProxyShopDomain(
      params.get("shop") ??
        (typeof body.shop === "string" ? body.shop : null),
    );
    if (!shopDomain) {
      return NextResponse.json(
        { error: "shop is required" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const shop = await getShopByDomain(shopDomain);
    if (!shop || shop.uninstalledAt) {
      return NextResponse.json(
        { error: "Shop not found" },
        { status: 404, headers: corsHeaders(origin) },
      );
    }

    const action = String(body.action ?? "signup");
    const {
      upsertReferralAdvocate,
      issueFriendDiscount,
    } = await import("@/services/referrals/engine");

    if (action === "redeem") {
      const code = String(body.code ?? body.advocate_code ?? "").trim();
      if (!code) {
        return NextResponse.json(
          { error: "Referral code is required" },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      const result = await issueFriendDiscount({
        shopId: shop.id,
        advocateCode: code,
        friendEmail:
          typeof body.email === "string" ? body.email : null,
      });

      return NextResponse.json(
        {
          ok: true,
          discountCode: result.discountCode,
          discountUrl: result.discountUrl,
          offerLabel: result.offerLabel,
          shareText: result.shareText,
          redeemDelayMs: result.redeemDelayMs,
        },
        { headers: corsHeaders(origin) },
      );
    }

    const email = String(body.email ?? "").trim();
    const sourceRaw = String(body.source ?? "onsite");
    const source: AdvocateSource =
      sourceRaw === "post_review" || sourceRaw === "post_purchase"
        ? sourceRaw
        : "onsite";

    const advocate = await upsertReferralAdvocate({
      shopId: shop.id,
      email,
      name: typeof body.name === "string" ? body.name : null,
      source,
      marketingConsent: Boolean(body.marketing_consent ?? body.marketingConsent),
      productTitle:
        typeof body.product_title === "string" ? body.product_title : null,
    });

    const shareUrl = `https://${shop.shopifyDomain}/?or_ref=${encodeURIComponent(advocate.code)}`;

    return NextResponse.json(
      {
        ok: true,
        code: advocate.code,
        shareUrl,
        email: advocate.email,
      },
      { headers: corsHeaders(origin) },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Referral request failed",
      },
      { status: 400, headers: corsHeaders(origin) },
    );
  }
}
