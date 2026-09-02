import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Resolve the public app URL for the current request.
 * Prefer proxy headers (nginx / load balancer) so OAuth redirect_uri matches
 * what the browser actually uses.
 */
export function resolveRequestAppUrl(request: NextRequest): URL {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = forwardedHost ?? request.headers.get("host");

  if (host) {
    const protocol =
      forwardedProto ??
      (request.nextUrl.protocol
        ? request.nextUrl.protocol.replace(":", "")
        : "https");
    return new URL(`${protocol}://${host}`);
  }

  return env.appUrl();
}

export function isSecureAppUrl(url: URL) {
  return url.protocol === "https:";
}
