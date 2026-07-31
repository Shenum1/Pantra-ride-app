import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  // Web: the API is served from the same origin as the page, dev or deployed.
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }

  // Native dev (Expo Go / dev client): hostUri is the bundler's actual LAN/tunnel
  // address, auto-detected by Expo — only present during development.
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    return `http://${hostUri}`;
  }

  // Native production build: no dev bundler, fall back to the configured deployed URL.
  const explicitUrl = Constants.expoConfig?.extra?.rorkApiBaseUrl;
  if (explicitUrl) {
    return explicitUrl;
  }

  throw new Error(
    "No base url found. Set EXPO_PUBLIC_RORK_API_BASE_URL in .env for production builds."
  );
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      headers: async () => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});