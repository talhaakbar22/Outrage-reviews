import { NextRequest, NextResponse } from "next/server";
import { beginOAuth, normalizeShopDomain } from "@/lib/shopify/auth";
import { loadOfflineSession } from "@/services/shop/service";

export async function GET(request: NextRequest) {
  const shopParam = request.nextUrl.searchParams.get("shop");

  if (!shopParam) {
    return NextResponse.json(
      {
        error:
          "Missing shop parameter. Example: /api/auth?shop=your-store.myshopify.com",
      },
      { status: 400 },
    );
  }

  const shop = normalizeShopDomain(shopParam);
  const existingSession = await loadOfflineSession(shop);

  if (existingSession?.accessToken && existingSession.isActive(undefined)) {
    const dashboard = new URL("/dashboard", request.nextUrl.origin);
    dashboard.searchParams.set("shop", shop);
    const host = request.nextUrl.searchParams.get("host");
    if (host) {
      dashboard.searchParams.set("host", host);
    }
    return NextResponse.redirect(dashboard);
  }

  return beginOAuth(request, shop);
}
