import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

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
