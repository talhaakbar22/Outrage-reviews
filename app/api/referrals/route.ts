import { NextRequest, NextResponse } from "next/server";
import { requireApiShop } from "@/lib/dashboard/shop-context";
import {
  getReferralSettings,
  normalizeReferralSettings,
  saveReferralSettings,
} from "@/services/referrals/settings";

export async function GET(request: NextRequest) {
  const auth = await requireApiShop(request.nextUrl.searchParams.get("shop"));
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const settings = await getReferralSettings(auth.shop.id);
  return NextResponse.json({
    ok: true,
    settings,
    currency: auth.shop.currency ?? "GBP",
    shopName: auth.shop.name ?? auth.shop.shopifyDomain,
  });
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireApiShop(request.nextUrl.searchParams.get("shop"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const settings = await saveReferralSettings(
      auth.shop.id,
      normalizeReferralSettings(body.settings ?? body),
    );
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save referrals",
      },
      { status: 400 },
    );
  }
}
