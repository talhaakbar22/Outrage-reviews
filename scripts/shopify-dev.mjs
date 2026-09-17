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
 *
 * Multi-store: set SHOPIFY_DEV_STORE=your-store.myshopify.com (or pass
 * --store=…) so theme extension sync targets that shop. One CLI process
 * syncs one store; switch SHOPIFY_DEV_STORE and re-run for another.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tomlPath = join(root, "shopify.app.toml");
const projectPath = join(root, ".shopify", "project.json");

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

function normalizeStoreDomain(raw) {
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (!trimmed) return undefined;
  return trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
}

function writeProjectStore(clientId, storeDomain) {
  if (!clientId || !storeDomain) return;
  let existing = {};
  try {
    existing = JSON.parse(readFileSync(projectPath, "utf8"));
  } catch {
    existing = {};
  }
  existing[clientId] = {
    ...(existing[clientId] ?? {}),
    dev_store_url: storeDomain,
  };
  writeFileSync(projectPath, `${JSON.stringify(existing, null, 2)}\n`);
}

const rawAppUrl = readEnvValue("SHOPIFY_APP_URL")?.trim().replace(/\/$/, "");
const extraArgs = process.argv.slice(2);
const storeFromFlag = (() => {
  const idx = extraArgs.findIndex(
    (arg) => arg === "--store" || arg.startsWith("--store="),
  );
  if (idx === -1) return undefined;
  const arg = extraArgs[idx];
  if (arg.startsWith("--store=")) return arg.slice("--store=".length);
  return extraArgs[idx + 1];
})();
const storeDomain = normalizeStoreDomain(
  storeFromFlag || readEnvValue("SHOPIFY_DEV_STORE"),
);

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
const clientIdMatch = originalToml.match(/^client_id\s*=\s*"([^"]+)"/m);
const clientId = clientIdMatch?.[1];
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

if (storeDomain && clientId) {
  writeProjectStore(clientId, storeDomain);
}

const tunnelUrl = `${rawAppUrl}:${CLI_PROXY_PORT}`;
const cliArgs = ["app", "dev", "--tunnel-url", tunnelUrl];

if (storeDomain && !storeFromFlag) {
  cliArgs.push("--store", storeDomain);
}

cliArgs.push(...extraArgs);

console.log(`Using application_url=${rawAppUrl}`);
console.log(`Using tunnel URL: ${tunnelUrl}`);
if (storeDomain) {
  console.log(`Using dev store: ${storeDomain}`);
} else {
  console.log(
    "No SHOPIFY_DEV_STORE set — CLI will use the last linked store (or prompt).",
  );
  console.log(
    "Tip: SHOPIFY_DEV_STORE=dev-outrage.myshopify.com yarn shopify:dev",
  );
}
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

const result = spawnSync("shopify", cliArgs, {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

restoreToml();
process.exit(result.status ?? 1);
