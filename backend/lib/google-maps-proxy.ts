import type { SupabaseClient } from "@supabase/supabase-js";
import { bearerToken } from "./admin-auth";

// Server side of the web-only Google Maps proxy (/api/google-maps, mounted in
// backend/hono.ts). The web build can't call the Google web-service APIs
// directly (no CORS), so lib/google-maps-service.ts routes them through here
// and the server attaches the Maps key.
//
// Before: anyone on the internet could use this route as an open proxy for
// ANY /maps/api/* endpoint on our key. Now:
//   1. the caller must present a valid Supabase session (Bearer token,
//      verified with auth.getUser exactly like authedProcedure does), and
//   2. only the exact endpoints the app actually calls (see
//      lib/google-maps-service.ts) are forwarded.
// Native builds call Google directly and never hit this route.

const GOOGLE_MAPS_ORIGIN = "https://maps.googleapis.com";

export const ALLOWED_GOOGLE_MAPS_PATHS: ReadonlySet<string> = new Set([
  "/maps/api/place/autocomplete/json",
  "/maps/api/place/details/json",
  "/maps/api/place/textsearch/json",
  "/maps/api/place/nearbysearch/json",
  "/maps/api/place/photo",
  "/maps/api/directions/json",
  "/maps/api/geocode/json",
  // Only fetched by the maps diagnostic screen (GoogleMapsService.runDiagnostics).
  "/maps/api/staticmap",
]);

export function isAllowedGoogleMapsPath(path: string): boolean {
  return ALLOWED_GOOGLE_MAPS_PATHS.has(path);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export interface GoogleMapsProxyDeps {
  supabaseAdmin: SupabaseClient | null;
  apiKey: string | undefined;
  fetchImpl?: typeof fetch;
}

export async function handleGoogleMapsProxy(req: Request, deps: GoogleMapsProxyDeps): Promise<Response> {
  const { supabaseAdmin, apiKey } = deps;
  const fetchImpl = deps.fetchImpl ?? fetch;

  if (!supabaseAdmin) {
    return json({ status: "REQUEST_DENIED", error_message: "Google Maps proxy is not configured." }, 500);
  }

  const token = bearerToken(req.headers.get("authorization"));
  if (!token) {
    return json({ status: "REQUEST_DENIED", error_message: "Missing session token." }, 401);
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return json({ status: "REQUEST_DENIED", error_message: "Invalid or expired session." }, 401);
  }

  const requestUrl = new URL(req.url);
  const rawPath = requestUrl.searchParams.get("path");
  if (!rawPath) {
    return json({ status: "INVALID_REQUEST", error_message: "Missing Google Maps path." }, 400);
  }

  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  // Exact-match allowlist (no prefix match), so "..", encoded segments or
  // query smuggling in `path` can never reach a different endpoint.
  if (!isAllowedGoogleMapsPath(path)) {
    return json({ status: "INVALID_REQUEST", error_message: "Unsupported Google Maps path." }, 400);
  }

  if (!apiKey) {
    return json({ status: "REQUEST_DENIED", error_message: "Google Maps API key is missing." }, 500);
  }

  const googleUrl = new URL(path, GOOGLE_MAPS_ORIGIN);
  for (const [key, value] of requestUrl.searchParams.entries()) {
    if (key !== "path" && key !== "key") {
      googleUrl.searchParams.set(key, value);
    }
  }
  googleUrl.searchParams.set("key", apiKey);

  const response = await fetchImpl(googleUrl);
  const contentType = response.headers.get("content-type") ?? "application/json";
  const body = await response.arrayBuffer();

  return new Response(body, {
    status: response.status,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
    },
  });
}
