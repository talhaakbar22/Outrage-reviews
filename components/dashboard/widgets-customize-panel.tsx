"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  CustomerSayWidgetPreview,
  useCustomerSayPreview,
} from "@/components/dashboard/widget-preview/customer-say-widget";

type PreviewProduct = {
  id: string;
  title: string;
  shopifyProductId: string;
  reviewCount: number;
  avgRating: number | null;
  imageUrl: string | null;
};

export function WidgetsCustomizePanel({ shopDomain }: { shopDomain: string }) {
  const [products, setProducts] = useState<PreviewProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const [productsError, setProductsError] = useState<string | null>(null);
  const [productsLoading, setProductsLoading] = useState(true);

  const selectedProduct = useMemo(
    () =>
      products.find(
        (product) => product.shopifyProductId === selectedProductId,
      ),
    [products, selectedProductId],
  );

  const { data, loading, loadingMore, error, readMore } = useCustomerSayPreview(
    shopDomain,
    selectedProductId,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        setProductsLoading(true);
        setProductsError(null);
        const params = new URLSearchParams({
          shop: shopDomain,
          mode: "products",
        });
        const response = await fetch(
          `/api/widgets/customer-say?${params.toString()}`,
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load products");
        }
        if (cancelled) return;
        const list = (payload.products ?? []) as PreviewProduct[];
        setProducts(list);
        if (list[0]) {
          setSelectedProductId((current) => current ?? list[0].shopifyProductId);
        }
      } catch (err) {
        if (cancelled) return;
        setProductsError(
          err instanceof Error ? err.message : "Failed to load products",
        );
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    }

    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, [shopDomain]);

  return (
    <div className="space-y-4">
      {productsLoading ? (
        <p className="text-sm text-zinc-500">Loading products…</p>
      ) : null}

      {productsError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{productsError}</p>
      ) : null}

      {products.length > 0 ? (
        <label className="block min-w-[260px] text-sm md:max-w-sm">
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
        loading={Boolean(selectedProductId) && loading}
        loadingMore={loadingMore}
        onReadMore={() => void readMore()}
        hideSummary
      />
    </div>
  );
}
