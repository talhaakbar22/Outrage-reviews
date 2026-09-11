import {
  buildProductTemplateEditorLink,
  buildThemeBlockDeepLink,
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
  const productTemplateUrl = buildProductTemplateEditorLink(shopDomain);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/30">
        <p className="font-semibold text-amber-950 dark:text-amber-100">
          Before adding widgets to your theme
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-900/90 dark:text-amber-100/90">
          Outrage Reviews widgets are <strong>theme blocks</strong> on the product
          page — not <strong>App embeds</strong>. If &quot;customer-say not added&quot;
          appears, the theme extension has not been pushed to Shopify yet.{" "}
          <code className="rounded bg-white/70 px-1 dark:bg-zinc-950">yarn dev</code>{" "}
          and ngrok alone are not enough — run Shopify CLI to upload blocks.
        </p>
        <code className="mt-3 block rounded-lg bg-white/80 px-3 py-2 text-xs text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          yarn shopify:dev
        </code>
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-200/80">
          Using your own ngrok tunnel:{" "}
          <code className="rounded bg-white/70 px-1 dark:bg-zinc-950">
            shopify app dev --tunnel-url=https://YOUR-SUBDOMAIN.ngrok-free.app:443
          </code>
        </p>
      </div>

      <div>
        <p className="lux-eyebrow">Storefront</p>
        <h1 className="lux-page-title mt-2">Luxury review widgets</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Editorial review experiences for your product pages — refined typography,
          soft surfaces, and a premium reading feel that still matches your zinc
          brand palette.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article className="overflow-hidden rounded-[1.5rem] border border-zinc-950/90 bg-white shadow-[0_22px_48px_-34px_rgba(24,24,27,0.45)] ring-1 ring-zinc-950/10 dark:border-zinc-50 dark:bg-zinc-950 dark:shadow-[0_22px_48px_-30px_rgba(0,0,0,0.8)] dark:ring-zinc-50/10">
          <div className="border-b border-zinc-200 bg-gradient-to-br from-zinc-50 via-white to-zinc-100 p-4 dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900">
            <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-zinc-700 dark:bg-zinc-950">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="font-display text-2xl font-semibold tracking-[-0.03em] text-zinc-950 dark:text-zinc-50">
                    4.9
                  </div>
                  <div className="text-zinc-900 dark:text-zinc-100">★★★★★</div>
                </div>
                <p className="font-display text-lg font-semibold tracking-[-0.02em] text-zinc-900 dark:text-zinc-100">
                  What customers say
                </p>
                <p className="line-clamp-3 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
                  Reviewers repeatedly call out quality, comfort, and fast delivery
                  when describing this product.
                </p>
                <div className="flex flex-wrap gap-1">
                  {["Quality 24", "Gift 12", "Delivery 8"].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] tracking-[0.02em] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-5">
            <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-zinc-950 dark:text-zinc-50">
              What customers say
            </h2>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              AI summary of approved reviews, including short 1–2 word comments, with
              theme tags and an expandable review list.
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

      <section
        id="customize-customer-say"
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Customize: What customers say
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Preview ratings and reviews for a product from your store. Summary text
            is shown on the storefront widget only.
          </p>
        </div>

        <WidgetsCustomizePanel shopDomain={shopDomain} />

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <p className="font-medium text-zinc-950 dark:text-zinc-50">
            How to add this widget to your theme
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

          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            Manual path: Theme editor → Product page → <strong>Add section</strong> →{" "}
            <strong>Apps</strong> → <strong>What customers say</strong>. Drag the
            section where you want it (usually below product details).
          </p>
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200/90">
            Seeing two widgets? You added it twice — once as a <strong>block</strong>{" "}
            inside Product information and once as a <strong>section</strong>. Delete
            the block inside Product information and keep only the full-width section
            at the bottom.
          </p>
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200/90">
            If you see a JSON/ngrok error, open the widget settings and clear{" "}
            <strong>Direct app URL</strong> — leave it blank so data loads via app
            proxy.
          </p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Data loads from{" "}
            <code className="rounded bg-white px-1 py-0.5 dark:bg-zinc-950">
              /apps/outrage-reviews/customer-say
            </code>
            . “Read all reviews” paginates through published reviews.
          </p>
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
