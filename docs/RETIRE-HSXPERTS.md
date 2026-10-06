# Retiring hsxperts.co → Firebase

The client domain **https://hsxperts.co** is no longer acceptable.

## What replaces it

| Concern | Old | New |
|---|---|---|
| Staff UI entry | Open hsxperts.co | Firebase-hosted **Outrage London dashboard** → Stock Management → Outrage Reviews |
| Shopify `application_url` | `https://hsxperts.co` | Firebase project **`outrageldn-dashboard`** (App Hosting / custom domain for the Next reviews app) |
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
4. When Reviews is deployed on Firebase, set App URL + redirect to that Firebase HTTPS host (not hsxperts.co).

## Firebase Hosting note

`https://outrageldn-dashboard.web.app` currently serves the **main dashboard SPA**, not the Next.js Reviews API routes. Shopify OAuth/callbacks need the Reviews Next (or Cloud Functions) host. Plan:

1. Deploy Outrage Reviews to **Firebase App Hosting** (or Cloud Run) on `outrageldn-dashboard`.
2. Point Shopify Partners + `SHOPIFY_APP_URL` at that URL.
3. Keep staff launching Reviews from the dashboard tab (Firebase Auth already on that project).

See also: [FIREBASE-PHASE-2.md](./FIREBASE-PHASE-2.md).
