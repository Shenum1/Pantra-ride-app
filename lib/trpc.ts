import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import Constants from "expo-constants";
import { supabase } from "./supabase";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  const url = Constants.expoConfig?.extra?.rorkApiBaseUrl;

  if (url) {
    return url;
  }

  throw new Error(
    "No base url found, please set rorkApiBaseUrl in app.config.js"
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