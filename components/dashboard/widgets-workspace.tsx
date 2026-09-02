"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CustomerSayWidgetPreview,
  useCustomerSayPreview,
} from "@/components/dashboard/widget-preview/customer-say-widget";
import {
  buildProductTemplateEditorLink,
  buildThemeBlockDeepLink,
  THEME_INSTALL_STEPS,
} from "@/lib/shopify/theme-editor";

type PreviewProduct = {
  id: string;
  title: string;
  shopifyProductId: string;
  reviewCount: number;
  avgRating: number | null;
  imageUrl: string | null;
};

const widgetCatalog = [
  {
    id: "customer-say",
    block: "customer-say" as const,
    title: "What customers say",
    badge: null as string | null,
    description:
      "AI-style summary of recent verified reviews with theme tags, quote snippets, and expandable full review list.",
    active: true,
  },
];

export function WidgetsWorkspace({
  shopDomain,
  shopifyApiKey,
}: {
  shopDomain: string;
  shopifyApiKey: string;
}) {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop") ?? shopDomain;
  const host = searchParams.get("host");

  const [query, setQuery] = useState("");
  const [selectedWidget, setSelectedWidget] = useState("customer-say");
  const [products, setProducts] = useState<PreviewProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );

  const selectedProduct = useMemo(
    () => products.find((product) => product.shopifyProductId === selectedProductId),
    [products, selectedProductId],
  );

  const { data, loading, loadingMore, error, readMore } = useCustomerSayPreview(
    shop,
    selectedProductId,
  );

  useEffect(() => {
    async function loadProducts() {
      const params = new URLSearchParams({ shop, mode: "products" });
      const response = await fetch(`/api/widgets/customer-say?${params.toString()}`);
      const payload = await response.json();
      if (response.ok) {
        const list = (payload.products ?? []) as PreviewProduct[];
        setProducts(list);
        if (list[0]) {
          setSelectedProductId((current) => current ?? list[0].shopifyProductId);
        }
      }
    }

    void loadProducts();
  }, [shop]);

  const filteredWidgets = widgetCatalog.filter((widget) => {
    if (!query.trim()) return true;
    const haystack = `${widget.title} ${widget.description}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const productTemplateUrl = useMemo(
    () => buildProductTemplateEditorLink(shop),
    [shop],
  );

  const customerSayDeepLink = useMemo(
    () =>
      buildThemeBlockDeepLink({
        shopDomain: shop,
        shopifyApiKey,
        block: "customer-say",
        target: "newAppsSection",
      }),
    [shop, shopifyApiKey],
  );

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

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Widgets
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Add review widgets to your storefront theme. Preview how they look
            before publishing.
          </p>
        </div>
        <label className="relative block min-w-[240px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
            ⌕
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search widgets"
            className="form-control py-2.5 pl-9"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredWidgets.map((widget) => {
          const active = selectedWidget === widget.id;
          const addToThemeUrl = buildThemeBlockDeepLink({
            shopDomain: shop,
            shopifyApiKey,
            block: widget.block,
          });

          return (
            <article
              key={widget.id}
              className={`overflow-hidden rounded-2xl border bg-white dark:bg-zinc-950 ${
                active
                  ? "border-zinc-950 ring-2 ring-zinc-950 dark:border-zinc-50 dark:ring-zinc-50"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="border-b border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                        4.9
                      </div>
                      <div className="text-amber-500">★★★★★</div>
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-700 dark:text-zinc-300">
                      What customers say
                    </p>
                    <p className="line-clamp-3 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
                      Reviewers repeatedly call out quality, comfort, and fast
                      delivery when describing this product.
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {["Quality 24", "Gift 12", "Delivery 8"].map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                    {widget.title}
                  </h2>
                  {widget.badge ? (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                      {widget.badge}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {widget.description}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedWidget(widget.id)}
                    className="btn-secondary"
                  >
                    Customize
                  </button>
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
          );
        })}
      </div>

      {selectedWidget === "customer-say" ? (
        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Customize: What customers say
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Preview the live widget using a product from your store.
              </p>
            </div>

            {products.length > 0 ? (
              <label className="min-w-[260px] text-sm">
                <span className="mb-2 block font-medium text-zinc-700 dark:text-zinc-300">
                  Preview product
                </span>
                <select
                  value={selectedProductId ?? ""}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                  className="form-control"
                >
                  {products.map((product) => (
                    <option
                      key={product.shopifyProductId}
                      value={product.shopifyProductId}
                    >
                      {product.title} ({product.reviewCount} reviews)
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {selectedProduct?.imageUrl ? (
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
              <Image
                src={selectedProduct.imageUrl}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg object-cover"
                unoptimized
              />
              <div>
                <p className="font-medium text-zinc-950 dark:text-zinc-50">
                  {selectedProduct.title}
                </p>
                <p className="text-xs text-zinc-500">
                  {selectedProduct.reviewCount} published reviews
                </p>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}

          <CustomerSayWidgetPreview
            data={data}
            loading={loading}
            loadingMore={loadingMore}
            onReadMore={() => void readMore()}
          />

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
              Seeing two widgets? You added it twice — once as a <strong>block</strong> inside
              Product information and once as a <strong>section</strong>. Delete the block
              inside Product information and keep only the full-width section at the bottom.
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
      ) : null}
    </div>
  );
}
