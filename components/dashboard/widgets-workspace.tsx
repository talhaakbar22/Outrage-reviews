import {
  buildProductTemplateEditorLink,
  buildThemeBlockDeepLink,
  buildThemeEmbedDeepLink,
  PRODUCT_CARD_RATINGS_STEPS,
  THEME_INSTALL_STEPS,
} from "@/lib/shopify/theme-editor";
import { WidgetsCustomizePanel } from "@/components/dashboard/widgets-customize-panel";

export function WidgetsWorkspace({
  shopDomain,
  shopifyApiKey,
  host,
}: {
  shopDomain: string;
  shopifyApiKey: string;
  host?: string;
}) {
  const addToThemeUrl = buildThemeBlockDeepLink({
    shopDomain,
    shopifyApiKey,
    block: "customer-say",
  });
  const customerSayDeepLink = buildThemeBlockDeepLink({
    shopDomain,
    shopifyApiKey,
    block: "customer-say",
    target: "newAppsSection",
  });
  const productCardRatingsEmbedUrl = buildThemeEmbedDeepLink({
    shopDomain,
    shopifyApiKey,
    embed: "product-card-ratings",
    template: "index",
  });
  const productTemplateUrl = buildProductTemplateEditorLink(shopDomain);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/30">
        <p className="font-semibold text-amber-950 dark:text-amber-100">
          Before adding widgets to your theme
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-900/90 dark:text-amber-100/90">
          Deploy the theme extension with{" "}
          <code className="rounded bg-white/70 px-1 dark:bg-zinc-950">
            yarn shopify:dev
          </code>{" "}
          or{" "}
          <code className="rounded bg-white/70 px-1 dark:bg-zinc-950">
            yarn shopify:deploy
          </code>
          . <strong>What customers say</strong> is a product-page section.{" "}
          <strong>Stars under product names everywhere</strong> (collections,
          search, cart) require the{" "}
          <strong>App embed</strong> named Product card ratings — same idea as
          Loox.
        </p>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Widgets
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Add review widgets to your storefront theme. Preview how they look
          before publishing.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article className="overflow-hidden rounded-2xl border border-zinc-950 bg-white ring-2 ring-zinc-950 dark:border-zinc-50 dark:bg-zinc-950 dark:ring-zinc-50">
          <div className="border-b border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
              <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                Product name
              </p>
              <p className="text-xs text-amber-600">★★★★☆ 4.2 (12)</p>
              <p className="text-sm text-zinc-600">$49.00</p>
            </div>
          </div>
          <div className="space-y-3 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
              Required for listings · like Loox
            </p>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Product card ratings
            </h2>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Shows stars + rating under every product name on collections,
              search, predictive search, related products, cart, and cart
              drawer — so shoppers see social proof before the product page.
            </p>
            <a
              href={productCardRatingsEmbedUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-primary inline-flex gap-2"
            >
              Enable site-wide (App embed)
              <span aria-hidden>↗</span>
            </a>
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                    4.9
                  </div>
                  <div className="text-zinc-900 dark:text-zinc-100">★★★★★</div>
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-700 dark:text-zinc-300">
                  What customers say
                </p>
                <p className="line-clamp-3 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
                  Reviewers repeatedly call out quality, comfort, and fast
                  delivery when describing this product.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-5">
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              What customers say
            </h2>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              AI summary of approved reviews on the product page — not the stars
              under product card titles.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a href="#customize-customer-say" className="btn-secondary">
                Customize
              </a>
              <a
                href={addToThemeUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-primary gap-2"
              >
                Add to theme
                <span aria-hidden>↗</span>
              </a>
            </div>
          </div>
        </article>
      </div>

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Stars under product names — step by step
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            This is separate from “What customers say”. Use App embeds.
          </p>
        </div>
        <ol className="list-decimal space-y-3 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          {PRODUCT_CARD_RATINGS_STEPS.map((step) => (
            <li key={step.title}>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {step.title}.{" "}
              </span>
              {step.body}
            </li>
          ))}
        </ol>
        <a
          href={productCardRatingsEmbedUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-primary inline-flex"
        >
          Open App embeds → Product card ratings
        </a>
      </section>

      <section
        id="customize-customer-say"
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Customize: What customers say
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Preview ratings and reviews for a product from your store. Summary
            text is shown on the storefront widget only.
          </p>
        </div>

        <WidgetsCustomizePanel shopDomain={shopDomain} />

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <p className="font-medium text-zinc-950 dark:text-zinc-50">
            How to add “What customers say” to your theme
          </p>
          <ol className="mt-3 list-decimal space-y-3 pl-5">
            {THEME_INSTALL_STEPS.map((step) => (
              <li key={step.title}>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {step.title}.{" "}
                </span>
                {step.body}
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={customerSayDeepLink}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
            >
              Add “What customers say” section
            </a>
            <a
              href={productTemplateUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              Open product template
            </a>
          </div>

          {host ? (
            <p className="mt-2 text-xs text-zinc-500">
              Shopify admin session detected — deep links open in a new tab.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
