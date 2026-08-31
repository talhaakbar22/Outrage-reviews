/**
 * OAuth scopes for v1 — product read, order read, product write (rating metafields).
 * @see https://shopify.dev/docs/api/usage/access-scopes
 */
export const SHOPIFY_SCOPES = [
  "read_products",
  "write_products",
  "read_orders",
  "read_customers",
] as const;

export type ShopifyScope = (typeof SHOPIFY_SCOPES)[number];

export const SHOPIFY_SCOPES_STRING = SHOPIFY_SCOPES.join(",");
