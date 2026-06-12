import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { supabaseAdmin } from "../lib/supabase-admin";

// Context creation function
export const createContext = async (opts: FetchCreateContextFnOptions) => {
  return {
    req: opts.req,
    // You can add more context items here like database connections, auth, etc.
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// Admin-only procedure: verifies the caller's Supabase session token belongs
// to a user with role='admin' before allowing access to service-role-key queries.
export const adminProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!supabaseAdmin) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Admin features are not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.",
    });
  }

  const authHeader = ctx.req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing admin session token." });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired session." });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("uid", userData.user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "This account does not have admin access." });
  }

  return next({ ctx: { ...ctx, adminUserId: userData.user.id, supabaseAdmin } });
});