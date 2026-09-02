#!/usr/bin/env node
/**
 * Validates SHOPIFY_APP_URL and temporarily patches shopify.app.toml for deploy.
 * Deploy requires a public HTTPS application URL; local dev should use `yarn shopify:dev`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tomlPath = join(root, "shopify.app.toml");

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

if (!rawAppUrl?.startsWith("https://")) {
  console.error(`
Deploy failed: SHOPIFY_APP_URL must be a public HTTPS URL for app proxy.

  Current value: ${rawAppUrl ?? "(not set)"}

For local theme extension testing (recommended while developing):
  yarn shopify:dev

To deploy an app version:
  1. Deploy/host this Next.js app (Vercel, Railway, Fly.io, etc.)
  2. Set SHOPIFY_APP_URL=https://your-public-app.example.com in .env
  3. Run yarn shopify:deploy again
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

writeFileSync(tomlPath, patchedToml);

console.log(`Using application_url=${rawAppUrl} for deploy…`);

const result = spawnSync(
  "shopify",
  ["app", "deploy", "--allow-updates"],
  {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  },
);

writeFileSync(tomlPath, originalToml);

process.exit(result.status ?? 1);
