import { NextRequest, NextResponse } from "next/server";
import { requireApiShop } from "@/lib/dashboard/shop-context";
import { getShopSettings, updateShopSettings } from "@/services/dashboard/data";

export async function GET(request: NextRequest) {
  const auth = await requireApiShop(request.nextUrl.searchParams.get("shop"));
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const settings = await getShopSettings(auth.shop.id);
  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireApiShop(request.nextUrl.searchParams.get("shop"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const settings = await updateShopSettings(auth.shop.id, body);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 400 },
    );
  }
}
