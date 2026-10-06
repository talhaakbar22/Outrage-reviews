import { redirect } from "next/navigation";
import { getDb } from "@/lib/prisma";
import { normalizeShopDomain } from "@/lib/shopify/auth";
import { loadOfflineSession } from "@/services/shop/service";
import {
  readDashboardShopCookies,
} from "@/lib/dashboard/shop-cookie";

export type DashboardShop = {
  id: string;
  name: string | null;
  shopifyDomain: string;
  email: string | null;
  currency: string | null;
  timezone: string | null;
};

export type ShopQuery = {
  shop?: string;
  host?: string;
};

export function shopQueryString(params: ShopQuery) {
  const query = new URLSearchParams();
  if (params.shop) query.set("shop", params.shop);
  if (params.host) query.set("host", params.host);
  const value = query.toString();
  return value ? `?${value}` : "";
}

export function withShopPath(path: string, params: ShopQuery) {
  return `${path}${shopQueryString(params)}`;
}

export async function requireDashboardShop(params: ShopQuery) {
  let shopParam = params.shop?.trim();
  let hostParam = params.host?.trim();

  // Soft navigations / iframe remounts sometimes drop ?shop=. Use the last
  // successful dashboard shop cookie so we don't bounce to Connect mid-flow.
  if (!shopParam) {
    const saved = await readDashboardShopCookies();
    if (saved.shop) {
      shopParam = saved.shop;
      hostParam = hostParam || saved.host;
    } else {
      redirect("/");
    }
  }

  const shopDomain = normalizeShopDomain(shopParam);
  const session = await loadOfflineSession(shopDomain);

  if (!session?.accessToken || !session.isActive(undefined)) {
    const auth = new URL("/api/auth", "http://local");
    auth.searchParams.set("shop", shopDomain);
    if (hostParam) {
      auth.searchParams.set("host", hostParam);
    }
    redirect(`${auth.pathname}${auth.search}`);
  }

  const db = getDb();
  const shop = await db.orm.public.Shop.where({
    shopifyDomain: shopDomain,
  }).first();

  if (!shop) {
    redirect("/");
  }

  return {
    shop: shop as DashboardShop,
    shopDomain,
    session,
    query: { shop: shopDomain, host: hostParam },
  };
}

export async function requireApiShop(shopParam: string | null) {
  if (!shopParam) {
    return { error: "Missing shop", status: 400 as const };
  }

  const shopDomain = normalizeShopDomain(shopParam);
  const session = await loadOfflineSession(shopDomain);

  if (!session?.accessToken || !session.isActive(undefined)) {
    return { error: "Unauthorized", status: 401 as const };
  }

  const db = getDb();
  const shop = await db.orm.public.Shop.where({
    shopifyDomain: shopDomain,
  }).first();

  if (!shop) {
    return { error: "Shop not found", status: 404 as const };
  }

  return { shop, shopDomain, session };
}
