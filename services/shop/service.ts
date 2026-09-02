import type { Session } from "@shopify/shopify-api";
import { getDb, nowInstant } from "@/lib/prisma";
import { fetchShopInfo } from "@/lib/shopify/webhooks";

export async function persistShopInstall(session: Session) {
  const db = getDb();
  const shopInfo = await fetchShopInfo(session);

  if (!shopInfo) {
    throw new Error("Unable to load shop details from Shopify");
  }

  const existing = await db.orm.public.Shop.where({
    shopifyDomain: session.shop,
  }).first();

  const shopRecord = existing
    ? await db.orm.public.Shop.where({ id: existing.id }).update({
        shopifyShopId: shopInfo.id,
        name: shopInfo.name,
        email: shopInfo.email,
        currency: shopInfo.currencyCode,
        timezone: shopInfo.ianaTimezone,
        uninstalledAt: null,
      })
    : await db.orm.public.Shop.create({
        shopifyDomain: session.shop,
        shopifyShopId: shopInfo.id,
        name: shopInfo.name,
        email: shopInfo.email,
        currency: shopInfo.currencyCode,
        timezone: shopInfo.ianaTimezone,
      });

  if (!shopRecord) {
    throw new Error("Failed to persist shop record");
  }

  const storedSession = await db.orm.public.ShopifySession.where({
    sessionId: session.id,
  }).first();

  const sessionPayload = {
    shopId: shopRecord.id,
    sessionId: session.id,
    isOnline: session.isOnline,
    scope: session.scope ?? null,
    accessToken: session.accessToken ?? "",
    expiresAt: session.expires ?? null,
  };

  if (storedSession) {
    await db.orm.public.ShopifySession.where({ id: storedSession.id }).update(
      sessionPayload,
    );
  } else {
    await db.orm.public.ShopifySession.create(sessionPayload);
  }

  const settings = await db.orm.public.ShopSettings.where({
    shopId: shopRecord.id,
  }).first();

  if (!settings) {
    await db.orm.public.ShopSettings.create({
      shopId: shopRecord.id,
    });
  }

  return shopRecord;
}

export async function loadOfflineSessionByShopId(shopId: string) {
  const db = getDb();
  const shop = await db.orm.public.Shop.where({ id: shopId }).first();

  if (!shop) {
    return null;
  }

  return loadOfflineSession(shop.shopifyDomain);
}

export async function loadOfflineSession(shopDomain: string) {
  const db = getDb();
  const shop = await db.orm.public.Shop.where({
    shopifyDomain: shopDomain,
  }).first();

  if (!shop) {
    return null;
  }

  const stored = await db.orm.public.ShopifySession.where({
    shopId: shop.id,
    isOnline: false,
  }).first();

  if (!stored?.accessToken) {
    return null;
  }

  const { Session } = await import("@shopify/shopify-api");

  return new Session({
    id: stored.sessionId,
    shop: shopDomain,
    state: "",
    isOnline: false,
    accessToken: stored.accessToken,
    scope: stored.scope ?? undefined,
    expires: stored.expiresAt ?? undefined,
  });
}

export async function markShopUninstalled(shopDomain: string) {
  const db = getDb();
  const shop = await db.orm.public.Shop.where({
    shopifyDomain: shopDomain,
  }).first();

  if (!shop) {
    return;
  }

  await db.orm.public.Shop.where({ id: shop.id }).update({
    uninstalledAt: nowInstant(),
  });
}
