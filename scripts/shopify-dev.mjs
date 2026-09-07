#!/usr/bin/env node
/**
 * Runs `shopify app dev` with a public tunnel URL from SHOPIFY_APP_URL.
 *
 * App proxy validation rejects application_url=http://localhost:3000
 * ("app_proxy requires a public host"). Temporarily patch shopify.app.toml
 * to the HTTPS ngrok URL (same approach as prepare-shopify-deploy.mjs).
 *
 * --tunnel-url port is the local port Shopify CLI binds for its reverse
 * proxy — it must NOT be 443 (needs root) or 3000 (Next.js). Traffic to
 * the app still hits Next via ngrok → :3000.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tomlPath = join(root, "shopify.app.toml");

/** Local port for Shopify CLI's reverse proxy (not Next.js, not 443). */
const CLI_PROXY_PORT = 3458;

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

const originalToml = readFileSync(tomlPath, "utf8");
const callbackUrl = `${rawAppUrl}/api/auth/callback`;

const patchedToml = originalToml
  .replace(
    /^application_url = .*$/m,
    `application_url = "${rawAppUrl}"`,
  )
  .replace(
    /(\[app_proxy\]\n)url = .*$/m,
    '$1url = "/api/storefront"',
  )
  .replace(
    /redirect_urls = \[[\s\S]*?\]/m,
    `redirect_urls = [\n  "${callbackUrl}"\n]`,
  );

function restoreToml() {
  try {
    writeFileSync(tomlPath, originalToml);
  } catch {
    // best-effort restore
  }
}

writeFileSync(tomlPath, patchedToml);

const tunnelUrl = `${rawAppUrl}:${CLI_PROXY_PORT}`;

console.log(`Using application_url=${rawAppUrl}`);
console.log(`Using tunnel URL: ${tunnelUrl}`);
console.log("Make sure `yarn dev` and ngrok (→ :3000) are already running.\n");

process.on("exit", restoreToml);
process.on("SIGINT", () => {
  restoreToml();
  process.exit(130);
});
process.on("SIGTERM", () => {
  restoreToml();
  process.exit(143);
});

const result = spawnSync(
  "shopify",
  ["app", "dev", "--tunnel-url", tunnelUrl, ...extraArgs],
  {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  },
);

restoreToml();
process.exit(result.status ?? 1);
