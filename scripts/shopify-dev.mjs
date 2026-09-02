#!/usr/bin/env node
/**
 * Runs `shopify app dev` with a public tunnel URL from SHOPIFY_APP_URL.
 * Required because [app_proxy] url = "/api/storefront" only validates when
 * application_url is HTTPS — localhost causes "app_proxy requires a public host".
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readEnvValue(name) {
  if (process.env[name]) return process.env[name];

  try {
    const envFile = readFileSync(join(root, ".env"), "utf8");
    for (const line of envFile.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key === name) {
        return rest
          .join("=")
          .trim()
          .replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env optional
  }

  return undefined;
}

const rawAppUrl = readEnvValue("SHOPIFY_APP_URL")?.trim().replace(/\/$/, "");
const extraArgs = process.argv.slice(2);

if (!rawAppUrl?.startsWith("https://")) {
  console.error(`
shopify app dev failed: SHOPIFY_APP_URL must be a public HTTPS URL.

  Current value: ${rawAppUrl ?? "(not set)"}

Why: app_proxy (/apps/outrage-reviews/…) requires a public host. With
application_url = http://localhost:3000, Shopify rejects the dev preview.

Fix:
  1. Start ngrok:  ngrok http 3000
  2. Set .env:     SHOPIFY_APP_URL=https://YOUR-SUBDOMAIN.ngrok-free.app
  3. Start app:    yarn dev   (in another terminal)
  4. Run again:    yarn shopify:dev

Or deploy without live dev sync:  yarn shopify:deploy
`);
  process.exit(1);
}

const tunnelUrl = `${rawAppUrl}:443`;

console.log(`Using tunnel URL: ${tunnelUrl}`);
console.log("Make sure `yarn dev` and ngrok are already running.\n");

const result = spawnSync(
  "shopify",
  ["app", "dev", "--tunnel-url", tunnelUrl, ...extraArgs],
  {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  },
);

process.exit(result.status ?? 1);
