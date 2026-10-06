import { NextRequest, NextResponse } from "next/server";
import { normalizeShopDomain } from "@/lib/shopify/auth";
import {
  DASHBOARD_HOST_COOKIE,
  DASHBOARD_SHOP_COOKIE,
} from "@/lib/dashboard/shop-cookie";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Persist the active dashboard shop so soft navigations that drop ?shop=
 * can recover without bouncing to the Connect page.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    shop?: string;
    host?: string;
  };

  if (!body.shop?.trim()) {
    return NextResponse.json({ error: "Missing shop" }, { status: 400 });
  }

  const shop = normalizeShopDomain(body.shop);
  const response = NextResponse.json({ ok: true, shop });

  response.cookies.set(DASHBOARD_SHOP_COOKIE, shop, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
  });

  if (body.host?.trim()) {
    response.cookies.set(DASHBOARD_HOST_COOKIE, body.host.trim(), {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: true,
    });
  }

  return response;
}
