export type ThemeBlockId =
  | "customer-say"
  | "review-list"
  | "review-summary"
  | "stars";

export function shopHandleFromDomain(shopDomain: string) {
  return shopDomain.replace(/\.myshopify\.com$/i, "");
}

/**
 * Deep link that opens the product template and adds an Outrage Reviews app block.
 * Requires the theme app extension to be deployed (`shopify app deploy` or `shopify app dev`).
 *
 * @see https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration#deep-linking
 */
export function buildThemeBlockDeepLink(input: {
  shopDomain: string;
  shopifyApiKey: string;
  block: ThemeBlockId;
  template?: string;
}) {
  const storeHandle = shopHandleFromDomain(input.shopDomain);
  const params = new URLSearchParams({
    template: input.template ?? "product",
    addAppBlockId: `${input.shopifyApiKey}/${input.block}`,
    target: "newAppsSection",
  });

  return `https://admin.shopify.com/store/${storeHandle}/themes/current/editor?${params.toString()}`;
}

export function buildProductTemplateEditorLink(shopDomain: string) {
  const storeHandle = shopHandleFromDomain(shopDomain);
  return `https://admin.shopify.com/store/${storeHandle}/themes/current/editor?template=product`;
}

export const THEME_INSTALL_STEPS = [
  {
    title: "Deploy the theme extension",
    body: "From the project root, run `shopify app deploy` (production) or `shopify app dev` (local). This pushes the Outrage Reviews blocks to Shopify. Without this step, blocks will not appear in the theme editor.",
  },
  {
    title: "Open the product page template",
    body: "In the theme editor, switch the preview to Products → Default product (or your product template). Do not use the “App embeds” tab — our widgets are theme blocks, not embeds.",
  },
  {
    title: "Add the block",
    body: "Click “Add block” on a product section (for example Main product), open the Apps category, and choose “What customers say” (or use Add to theme below for a deep link).",
  },
  {
    title: "Save and publish",
    body: "Save the theme. The widget loads review summaries from `/apps/outrage-reviews/customer-say` via the app proxy.",
  },
] as const;
