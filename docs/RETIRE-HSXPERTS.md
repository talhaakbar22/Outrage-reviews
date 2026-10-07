# Retiring hsxperts.co → Firebase

The client domain **https://hsxperts.co** is no longer acceptable.

## What replaces it

| Concern | Old | New |
|---|---|---|
| Staff UI entry | Open | Firebase-hosted **Outrage London dashboard** → Stock Management → Outrage Reviews |
| Shopify `application_url` | **`https://nthio.app`** (production Reviews host) |
| Data backend | Postgres on the old host | Firebase Firestore (`reviewShops/…`) — Phase 2+ |
| Local OAuth | often pointed at hsxperts | `SHOPIFY_APP_URL` = ngrok HTTPS while developing |

## Code changes already made

- Dashboard no longer falls back to hsxperts.co (`OutrageReviewsView.jsx`).
- `shopify.app.toml` no longer lists hsxperts.co.
- `next.config.ts` `allowedDevOrigins` no longer includes hsxperts.co.

## What you must do in Shopify Partners

1. Open the Outrage Reviews app in [Shopify Partners](https://partners.shopify.com/).
2. Remove any **hsxperts.co** App URL / redirect URLs.
3. Until Firebase App Hosting for Reviews is live, use your **ngrok** URL for local installs:
   - App URL: `https://YOUR-NGROK.ngrok-free.app`
   - Redirect: `https://YOUR-NGROK.ngrok-free.app/api/auth/callback`
4. Production App URL + redirect must be **`https://nthio.app`** (not hsxperts.co).

## Production host

- App URL: `https://nthio.app`
- OAuth callback: `https://nthio.app/api/auth/callback`
- App proxy: `https://nthio.app/api/storefront` (via `/apps/outrage-reviews`)

After changing the domain, run `yarn shopify:deploy` so Shopify Partners picks up the new URLs.

See also: [FIREBASE-PHASE-2.md](./FIREBASE-PHASE-2.md).
