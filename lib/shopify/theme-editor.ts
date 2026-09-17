export type ThemeBlockId =
  | "customer-say"
  | "review-list"
  | "review-summary"
  | "stars";

export type ThemeEmbedId =
  | "product-card-ratings"
  | "referral-popup"
  | "referral-sidebar";

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

/**
 * Deep link that opens App embeds and activates an Outrage Reviews embed.
 * Use this for product-card star ratings under product titles.
 */
export function buildThemeEmbedDeepLink(input: {
  shopDomain: string;
  shopifyApiKey: string;
  embed: ThemeEmbedId;
  template?: string;
}) {
  const storeHandle = shopHandleFromDomain(input.shopDomain);
  const params = new URLSearchParams({
    context: "apps",
    activateAppId: `${input.shopifyApiKey}/${input.embed}`,
  });
  if (input.template) {
    params.set("template", input.template);
  }

  return `https://admin.shopify.com/store/${storeHandle}/themes/current/editor?${params.toString()}`;
}

export function buildProductTemplateEditorLink(shopDomain: string) {
  const storeHandle = shopHandleFromDomain(shopDomain);
  return `https://admin.shopify.com/store/${storeHandle}/themes/current/editor?template=product`;
}

export const THEME_INSTALL_STEPS = [
  {
    title: "Push the theme extension to Shopify",
    body: "Running only `yarn dev` + ngrok does not upload theme blocks. From the project root run `yarn shopify:dev` (recommended) or `shopify app deploy`.",
  },
  {
    title: "Open the product page template",
    body: "In the theme editor, switch the preview to Products → Default product (pick a product if prompted).",
  },
  {
    title: "Add as its own section",
    body: "Click Add section (not Add block) → Apps → What customers say. Place it below the product details.",
  },
  {
    title: "Save and publish",
    body: "Save the theme. The widget loads review summaries from `/apps/outrage-reviews/customer-say` via the app proxy.",
  },
] as const;

export const PRODUCT_CARD_RATINGS_STEPS = [
  {
    title: "Deploy the theme extension",
    body: "Run `yarn shopify:dev` or `yarn shopify:deploy` so “Product card ratings” appears under App embeds.",
  },
  {
    title: "Open App embeds (not Apps sections)",
    body: "Theme editor → click the nested dots / Theme settings → App embeds. Do not look under Related products → Add block.",
  },
  {
    title: "Enable Product card ratings",
    body: "Find Outrage Reviews → Product card ratings → turn the toggle ON → Save.",
  },
  {
    title: "Confirm products have reviews",
    body: "Stars only appear for products that already have approved/imported reviews in Outrage Reviews (rating + count).",
  },
] as const;
