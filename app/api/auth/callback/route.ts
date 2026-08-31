import { NextRequest, NextResponse } from "next/server";
import {
  buildPostAuthRedirectUrl,
  completeOAuth,
} from "@/lib/shopify/auth";
import { registerShopWebhooks } from "@/lib/shopify/webhooks";
import { enqueueInitialSync } from "@/lib/queue";
import { persistShopInstall } from "@/services/shop/service";

export async function GET(request: NextRequest) {
  try {
    const { session, headers } = await completeOAuth(request);
    const shopRecord = await persistShopInstall(session);

    await registerShopWebhooks(session);

    void enqueueInitialSync(shopRecord.id).catch((error) => {
      console.error("Initial sync enqueue failed:", error);
    });

    const redirectUrl = buildPostAuthRedirectUrl(request, session.shop);
    const response = NextResponse.redirect(redirectUrl);

    headers.forEach((value, key) => {
      response.headers.append(key, value);
    });

    return response;
  } catch (error) {
    console.error("OAuth callback failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "OAuth callback failed",
      },
      { status: 500 },
    );
  }
}
