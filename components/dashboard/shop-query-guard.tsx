"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STORAGE_SHOP = "or_dashboard_shop";
const STORAGE_HOST = "or_dashboard_host";

/**
 * Keeps ?shop= (and optional ?host=) on dashboard URLs.
 * Next soft-navigations / iframe reloads sometimes drop the query; without it
 * requireDashboardShop redirects to the "Connect your Shopify store" page.
 */
export function ShopQueryGuard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!pathname?.startsWith("/dashboard")) return;

    const shop = searchParams.get("shop")?.trim();
    const host = searchParams.get("host")?.trim();

    if (shop) {
      try {
        sessionStorage.setItem(STORAGE_SHOP, shop);
        if (host) sessionStorage.setItem(STORAGE_HOST, host);
        else sessionStorage.removeItem(STORAGE_HOST);
      } catch {
        // ignore storage failures (private mode, etc.)
      }

      void fetch("/api/dashboard/shop-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, host: host || undefined }),
      }).catch(() => {
        // Cookie persist is best-effort.
      });
      return;
    }

    let savedShop: string | null = null;
    let savedHost: string | null = null;
    try {
      savedShop = sessionStorage.getItem(STORAGE_SHOP);
      savedHost = sessionStorage.getItem(STORAGE_HOST);
    } catch {
      return;
    }

    if (!savedShop) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("shop", savedShop);
    if (savedHost) params.set("host", savedHost);
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, searchParams, router]);

  return null;
}
