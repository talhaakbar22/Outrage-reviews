import { cookies } from "next/headers";

export const DASHBOARD_SHOP_COOKIE = "or_dashboard_shop";
export const DASHBOARD_HOST_COOKIE = "or_dashboard_host";

export async function readDashboardShopCookies() {
  const jar = await cookies();
  const shop = jar.get(DASHBOARD_SHOP_COOKIE)?.value?.trim() || undefined;
  const host = jar.get(DASHBOARD_HOST_COOKIE)?.value?.trim() || undefined;
  return { shop, host };
}
