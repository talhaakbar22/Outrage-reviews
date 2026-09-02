import "@shopify/shopify-api/adapters/web-api";
import { ApiVersion, shopifyApi } from "@shopify/shopify-api";
import type { Session } from "@shopify/shopify-api";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { resolveRequestAppUrl } from "@/lib/shopify/request-origin";
import { SHOPIFY_SCOPES } from "@/lib/shopify/scopes";

type ShopifyClient = ReturnType<typeof shopifyApi>;

let defaultShopify: ShopifyClient | undefined;

function createShopifyClient(input: { hostName: string; hostScheme: "http" | "https" }) {
  return shopifyApi({
    apiKey: env.shopifyApiKey(),
    apiSecretKey: env.shopifyApiSecret(),
    scopes: [...SHOPIFY_SCOPES],
    hostName: input.hostName,
    hostScheme: input.hostScheme,
    apiVersion: ApiVersion.January26,
    isEmbeddedApp: env.isEmbeddedApp(),
  });
}

export function getShopify() {
  if (!defaultShopify) {
    const appUrl = env.appUrl();
    defaultShopify = createShopifyClient({
      hostName: appUrl.host,
      hostScheme: appUrl.protocol.replace(":", "") as "http" | "https",
    });
  }
  return defaultShopify;
}

/** Use for OAuth so redirect_uri + cookies align with the incoming request host. */
export function getShopifyForRequest(request: NextRequest) {
  const appUrl = resolveRequestAppUrl(request);
  return createShopifyClient({
    hostName: appUrl.host,
    hostScheme: appUrl.protocol.replace(":", "") as "http" | "https",
  });
}

export function createGraphqlClient(session: Session) {
  return new (getShopify().clients.Graphql)({ session });
}
