import { NextRequest, NextResponse } from "next/server";
import { requireApiShop } from "@/lib/dashboard/shop-context";
import {
  cancelCollectReviewRequest,
  sendCollectReviewRequestNow,
} from "@/services/reviews/collect";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const shopParam = request.nextUrl.searchParams.get("shop");
  const auth = await requireApiShop(shopParam);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
  };

  try {
    if (body.action === "send_now") {
      const result = await sendCollectReviewRequestNow({
        shopId: auth.shop.id,
        requestId: id,
      });
      return NextResponse.json(result);
    }

    if (body.action === "cancel") {
      const result = await cancelCollectReviewRequest({
        shopId: auth.shop.id,
        requestId: id,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Request failed",
      },
      { status: 400 },
    );
  }
}
