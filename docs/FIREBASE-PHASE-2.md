# Firebase Phase 2 — Outrage Reviews

## Verdict

Phase 2 is **good and possible**. This sets up Firebase **beside** Postgres. Do **not** delete PostgreSQL until repositories are ported (Phase 3+).

## Project choice

Default: **reuse** the existing dashboard project:

```text
outrageldn-dashboard
```

Why: the main Outrage dashboard already embeds this app, staff already have Firebase Auth there, and `reviewShops/{shopId}/…` namespaces cleanly next to existing collections.

If you instead want a **separate** Firebase project, say so and we will retarget `.firebaserc` + env vars. Do not create a second project unless you want isolated billing/IAM.

## What was added

### In `outrage-reviews`

| Piece | Path |
|---|---|
| Admin SDK | `lib/firebase/admin.ts` |
| Web client (optional) | `lib/firebase/client.ts` |
| Collection paths | `lib/firebase/collections.ts` |
| Cutover switch | `lib/firebase/data-backend.ts` (`REVIEWS_DATA_BACKEND=postgres\|firestore\|dual`) |
| Rules fragment | `firebase/firestore.reviews.rules` |
| Storage fragment | `firebase/storage.reviews.rules` |
| Indexes | `firebase/firestore.indexes.json` |
| Firebase config | `firebase.json`, `.firebaserc` |
| Cloud Functions codebase | `functions/` (`reviewsHealth`, `reviewsScheduledSweep`) |
| Smoke route | `GET /api/firebase/health` |

### In `outragelondondashboard`

| Piece | Path |
|---|---|
| Merged Firestore rules for `reviewShops` | `firestore.rules` |

Rules for reviews are **merged into the dashboard rules file** because both apps share one Firebase project. Deploying `firebase/firestore.reviews.rules` alone from this repo would wipe dashboard rules — **never** run `firebase deploy --only firestore` from `outrage-reviews`.

## Auth model (Phase 2)

| Actor | Auth |
|---|---|
| Shopify merchant (embedded app) | Shopify session → Next.js → **Firebase Admin** |
| Dashboard staff | Existing Firebase Auth on `outrageldn-dashboard` (read `reviewShops`) |
| Storefront / review links | Public token URLs via Next.js API (not direct Firestore) |
| Secrets (`sessions`, `reviewRequests.tokenHash`) | **Admin SDK only** — client rules deny |

Firebase Authentication does **not** replace Shopify OAuth in Phase 2.

## Storage

- Keep current S3/local media path working.
- Firebase Storage path reserved: `review-media/{shopId}/{reviewId}/{file}`
- Cut media over in a later phase if desired.

## Cloud Functions — when needed

Needed for:

- Reliable Shopify webhook intake at scale
- Scheduled review-request / reminder sweeps (replacing BullMQ later)

Not required for day-to-day dashboard CRUD in Phase 2 (Next.js + Admin SDK is enough).

## Local setup

1. Copy Firebase web config + service account into `.env` (see `.env.example`).
2. Keep `REVIEWS_DATA_BACKEND=postgres` until repositories are ported.
3. Optional emulators (from this repo, with Java 21+):

```bash
export JAVA_HOME="$HOME/.local/jdks/jdk-21.0.12.1+1/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
yarn firebase:emulators
```

4. Smoke check:

```bash
yarn dev
curl -s http://localhost:3000/api/firebase/health | jq
```

5. Deploy **rules** only from the dashboard repo:

```bash
cd ../outragelondondashboard
firebase deploy --only firestore:rules
```

6. Deploy **reviews functions** (optional) from this repo:

```bash
cd functions && yarn install
cd .. && yarn firebase deploy --only functions:outrage-reviews
```

## What Phase 2 does **not** do

- Does not migrate data out of Postgres
- Does not delete Postgres / Redis
- Does not rewrite `services/*` repositories to Firestore
- Does not change the Shopify app install flow

## Suggested next phase

Port repositories in this order (from the map):

1. `shop` + `shop_settings` + `shopify_session`
2. `product`
3. `review` + `review_media` + `review_reply`
4. `review_request`
5. orders / customers
6. jobs (`webhook_event`, `sync_job`) + retire BullMQ gradually
