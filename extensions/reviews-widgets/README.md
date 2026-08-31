# Reviews Theme App Extension

Storefront widgets for Outrage Reviews. Star ratings and summaries render from Shopify product metafields (`reviews.rating`, `reviews.count`, `reviews.rating_breakdown`) with **no API call**. Dynamic widgets load published reviews from your app via App Proxy or a direct API URL.

## Structure

```
extensions/reviews-widgets/
├── blocks/
│   ├── stars.liquid              # PDP + collection card stars
│   ├── review-summary.liquid     # Average + breakdown bars
│   ├── review-list.liquid        # Review list + photo gallery
│   └── customer-say.liquid       # “What customers say” summary widget
├── snippets/
│   └── stars.liquid
├── assets/
│   ├── reviews-widget.css
│   ├── reviews-widget.js
│   └── customer-say-widget.js
├── locales/
│   └── en.default.json
└── shopify.extension.toml
```

## Deploy (required before theme editor shows blocks)

Install [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) if needed:

```bash
npm install -g @shopify/cli @shopify/app
```

From the project root:

```bash
# Local development — syncs the theme extension to your dev store (use this while building)
yarn shopify:dev
```

Keep `yarn dev` running in another terminal. Do **not** use `--use-localhost` (app proxy needs a public tunnel).

```bash
# Production deploy — requires a hosted HTTPS app URL in .env
# SHOPIFY_APP_URL=https://your-app.example.com
yarn shopify:deploy
```

`shopify app deploy` fails with `app_proxy … requires a public host` when `SHOPIFY_APP_URL` is `http://localhost:3000`. That is expected until the app is hosted on HTTPS.

The app must be **installed** on the dev store. After `shopify app dev` or deploy, blocks appear in the theme editor.

## Merchant setup — where to find widgets

These are **theme blocks**, not **App embeds**.

| Wrong place | Right place |
|---|---|
| Theme settings → **App embeds** | Product template → section → **Add block** → **Apps** |

### Steps

1. Run `yarn shopify:deploy` (or `yarn shopify:dev` during development).
2. In Shopify admin: **Online Store → Themes → Customize**.
3. Open the preview dropdown and choose **Products → Default product**.
4. Click a product section (e.g. **Product information**).
5. Click **Add block** → **Apps** → choose **What customers say** (or Star rating / Review list / Review summary).
6. **Save** the theme.

Or use **Add to theme** in the app dashboard (Widgets tab) — it deep-links to the product template.

## Data sources

| Widget | Source |
|---|---|
| Stars | `product.metafields.reviews.rating` + `.count` |
| Summary | metafields including `rating_breakdown` |
| What customers say | `GET /apps/outrage-reviews/customer-say?product_id=…` |
| List / photos | `GET /apps/outrage-reviews/reviews?product_id=…` |

## Local testing

Set **App URL** on a block to your tunnel URL (e.g. `https://your-tunnel.example.com`) when not using the app proxy. Leave blank in production to use `/apps/outrage-reviews/…`.
