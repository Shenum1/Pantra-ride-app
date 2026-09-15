import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { supabaseAdmin } from "./lib/supabase-admin";
import { verifyPaystackSignature, verifyFlutterwaveSignature } from "./lib/webhook-signatures";
import { processVerifiedPayment } from "./lib/payment-processor";
import { checkPaymentEnvironmentConsistency } from "./lib/payment-env-check";

checkPaymentEnvironmentConsistency();

// app will be mounted at /api
const app = new Hono();

// Enable CORS for all routes
app.use("*", cors());

const GOOGLE_MAPS_ORIGIN = "https://maps.googleapis.com";

app.get("/google-maps", async (c) => {
  const rawPath = c.req.query("path");
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!rawPath) {
    return c.json({ status: "INVALID_REQUEST", error_message: "Missing Google Maps path." }, 400);
  }

  if (!apiKey) {
    return c.json({ status: "REQUEST_DENIED", error_message: "Google Maps API key is missing." }, 500);
  }

  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

  if (!path.startsWith("/maps/api/")) {
    return c.json({ status: "INVALID_REQUEST", error_message: "Unsupported Google Maps path." }, 400);
  }

  const googleUrl = new URL(path, GOOGLE_MAPS_ORIGIN);

  for (const [key, value] of new URL(c.req.url).searchParams.entries()) {
    if (key !== "path" && key !== "key") {
      googleUrl.searchParams.set(key, value);
    }
  }

  googleUrl.searchParams.set("key", apiKey);

  const response = await fetch(googleUrl);
  const contentType = response.headers.get("content-type") ?? "application/json";
  const body = await response.arrayBuffer();

  return new Response(body, {
    status: response.status,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
    },
  });
});

// Provider webhooks — the PRIMARY, asynchronous payment-confirmation path
// (Phase 2). Plain Hono routes, not tRPC procedures: providers POST a
// signed payload that doesn't speak tRPC's wire format, and Paystack's
// signature check requires the exact raw request body (c.req.text()), which
// a tRPC/JSON-body-parsing procedure would not preserve byte-for-byte.
//
// Neither handler wraps processVerifiedPayment in a try/catch: a genuine
// infrastructure failure (DB unavailable, unexpected exception) must
// propagate to Hono's default error handling (a 5xx), which is what tells
// the provider to retry delivery — the event must never be acknowledged
// (200) before its outcome has been durably recorded, per Phase 2's design.
// Every business-level outcome processVerifiedPayment can return
// (mismatch, duplicate, provider-confirmed failure) IS a durable, recorded
// write, so all of those correctly reach the 200 below.
app.post("/webhooks/paystack", async (c) => {
  if (!supabaseAdmin) {
    return c.json({ error: "not configured" }, 500);
  }

  const rawBody = await c.req.text();
  const signature = c.req.header("x-paystack-signature");

  if (!verifyPaystackSignature(rawBody, signature)) {
    console.error("Rejected Paystack webhook: invalid or missing signature.");
    return c.json({ error: "invalid signature" }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "malformed payload" }, 400);
  }

  const reference = payload?.data?.reference;
  if (!reference || typeof reference !== "string") {
    return c.json({ error: "missing reference" }, 400);
  }

  await processVerifiedPayment({
    supabaseAdmin,
    provider: "paystack",
    reference,
    sourceChannel: "webhook",
    providerEventId: payload?.data?.id != null ? String(payload.data.id) : undefined,
    eventType: payload?.event ?? "unknown",
  });

  return c.json({ received: true });
});

app.post("/webhooks/flutterwave", async (c) => {
  if (!supabaseAdmin) {
    return c.json({ error: "not configured" }, 500);
  }

  const rawBody = await c.req.text();
  const hash = c.req.header("verif-hash");

  if (!verifyFlutterwaveSignature(hash)) {
    console.error("Rejected Flutterwave webhook: invalid or missing verif-hash.");
    return c.json({ error: "invalid signature" }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "malformed payload" }, 400);
  }

  const reference = payload?.data?.tx_ref;
  if (!reference || typeof reference !== "string") {
    return c.json({ error: "missing reference" }, 400);
  }

  await processVerifiedPayment({
    supabaseAdmin,
    provider: "flutterwave",
    reference,
    sourceChannel: "webhook",
    providerEventId: payload?.data?.id != null ? String(payload.data.id) : undefined,
    eventType: payload?.event?.type ?? payload?.event ?? "unknown",
  });

  return c.json({ received: true });
});

// Mount tRPC router at /trpc
app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

// Simple health check endpoint
app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

export default app;
