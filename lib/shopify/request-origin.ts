import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

function firstHeaderValue(value: string | null): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}

function isLoopbackHost(host: string): boolean {
  const hostname = host.split(":")[0].replace(/^\[|\]$/g, "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/**
 * Resolve the public app URL for the current request.
 * Prefer proxy/tunnel headers (nginx, ngrok, load balancer) so redirects and
 * OAuth redirect_uri match what the browser actually uses.
 */
export function resolveRequestAppUrl(request: NextRequest): URL {
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const host = forwardedHost ?? firstHeaderValue(request.headers.get("host"));

  if (host) {
    const protocol =
      forwardedProto ??
      (request.nextUrl.protocol
        ? request.nextUrl.protocol.replace(":", "")
        : "https");
    const fromRequest = new URL(`${protocol}://${host}`);

    // ngrok forwards to upstream with Host: localhost:3000; SHOPIFY_APP_URL
    // should be the public https://….ngrok-free.app URL in that setup.
    if (isLoopbackHost(host)) {
      try {
        const fromEnv = env.appUrl();
        if (isSecureAppUrl(fromEnv) && !isLoopbackHost(fromEnv.host)) {
          return fromEnv;
        }
      } catch {
        // SHOPIFY_APP_URL not configured
      }
    }

    return fromRequest;
  }

  return env.appUrl();
}

export function isSecureAppUrl(url: URL) {
  return url.protocol === "https:";
}
