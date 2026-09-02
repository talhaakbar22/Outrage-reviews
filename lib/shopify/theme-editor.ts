export type ThemeBlockId =
  | "customer-say"
  | "review-list"
  | "review-summary"
  | "stars";

/** From extensions/reviews-widgets/shopify.extension.toml — used if api_key deep links fail. */
export const REVIEWS_WIDGETS_EXTENSION_UID =
  "60b6195a-6d86-ba05-cb34-7245edc7b42d847538e8";

export function shopHandleFromDomain(shopDomain: string) {
  return shopDomain.replace(/\.myshopify\.com$/i, "");
}

export type ThemeBlockDeepLinkTarget =
  | "mainSection"
  | "newAppsSection";

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
  target?: ThemeBlockDeepLinkTarget;
}) {
  const storeHandle = shopHandleFromDomain(input.shopDomain);
  const params = new URLSearchParams({
    template: input.template ?? "product",
    addAppBlockId: `${input.shopifyApiKey}/${input.block}`,
    target: input.target ?? "newAppsSection",
  });

  return `https://admin.shopify.com/store/${storeHandle}/themes/current/editor?${params.toString()}`;
}

export function buildProductTemplateEditorLink(shopDomain: string) {
  const storeHandle = shopHandleFromDomain(shopDomain);
  return `https://admin.shopify.com/store/${storeHandle}/themes/current/editor?template=product`;
}

export const THEME_INSTALL_STEPS = [
  {
    title: "Push the theme extension to Shopify",
    body: "Running only `yarn dev` + ngrok does not upload theme blocks. From the project root run `yarn shopify:dev` (recommended) or `shopify app deploy`. With your own ngrok tunnel: `shopify app dev --tunnel-url=https://YOUR-SUBDOMAIN.ngrok-free.app:443` while `yarn dev` runs elsewhere.",
  },
  {
    title: "Open the product page template",
    body: "In the theme editor, switch the preview to Products → Default product (pick a product if prompted). Do not use the “App embeds” tab — our widgets are theme blocks, not embeds.",
  },
  {
    title: "Add as its own section",
    body: "In the theme editor, click Add section (not Add block) → Apps → What customers say. This places the widget in a full-width section below the product. Or use “Add to theme” below for a deep link.",
  },
  {
    title: "Save and publish",
    body: "Save the theme. The widget loads review summaries from `/apps/outrage-reviews/customer-say` via the app proxy.",
  },
] as const;
