import "@shopify/shopify-api/adapters/web-api";
import { ApiVersion, shopifyApi } from "@shopify/shopify-api";
import type { Session } from "@shopify/shopify-api";
import { env } from "@/lib/env";
import { SHOPIFY_SCOPES } from "@/lib/shopify/scopes";

let shopify: ReturnType<typeof shopifyApi> | undefined;

export function getShopify() {
  if (!shopify) {
    shopify = shopifyApi({
      apiKey: env.shopifyApiKey(),
      apiSecretKey: env.shopifyApiSecret(),
      scopes: [...SHOPIFY_SCOPES],
      hostName: env.appHost(),
      hostScheme: env.appScheme(),
      apiVersion: ApiVersion.January26,
      isEmbeddedApp: env.isEmbeddedApp(),
    });
  }
  return shopify;
}

export function createGraphqlClient(session: Session) {
  return new (getShopify().clients.Graphql)({ session });
}
