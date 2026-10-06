export type ThemeBlockId =
  | "customer-say"
  | "customer-say-store"
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
    title: "Deploy the theme extension once",
    body: "Run yarn shopify:deploy. One app version ships the blocks to every store that has the app installed — you do not redeploy per store.",
  },
  {
    title: "Install / open the app on that store",
    body: "Each store needs its own install (Apps → Outrage Reviews). New stores run OAuth at the top level so admin.shopify.com is not nested in an iframe.",
  },
  {
    title: "Open the product page template",
    body: "In that store’s theme editor, switch the preview to Products → Default product (pick a product if prompted).",
  },
  {
    title: "Add as its own section",
    body: "Click Add section (not Add block inside Product information) → Apps → What customers say. Avoid inserting into a section that shows an HTML error.",
  },
  {
    title: "Save",
    body: "Save the theme. The widget loads from /apps/outrage-reviews/customer-say via the app proxy for that shop.",
  },
] as const;

export const STORE_REVIEWS_STEPS = [
  {
    title: "Deploy the theme extension",
    body: "Run `yarn shopify:dev` or `yarn shopify:deploy` so “All store reviews” appears under Apps sections.",
  },
  {
    title: "Open Home or a Reviews page",
    body: "Theme editor → preview Home, or create a page titled Reviews and open that template.",
  },
  {
    title: "Add the section",
    body: "Add section → Apps → All store reviews. Place it where you want the full review gallery.",
  },
  {
    title: "Save",
    body: "Shoppers see store-wide rating, summary, and every approved review with product links.",
  },
] as const;

export const PRODUCT_CARD_RATINGS_STEPS = [
  {
    title: "Open App embeds (required)",
    body: "Theme editor → Theme settings (⋯ or left gear) → App embeds. Do not add “Star rating” under Collection → Apps — that section cannot place blocks inside product cards (“No app blocks available”).",
  },
  {
    title: "Enable Product card ratings",
    body: "Find Outrage Reviews → Product card ratings → turn the toggle ON → Save. This injects stars under every product title store-wide (collections, search, cart, product page).",
  },
  {
    title: "Remove stray Star rating Apps sections",
    body: "If you added Star rating under Template → Apps on the collection template, remove those — they only render one block in a page section, not under each card.",
  },
  {
    title: "Verify",
    body: "Open a collection and a product page. Stars should appear under titles after Save (hard-refresh if needed).",
  },
] as const;
