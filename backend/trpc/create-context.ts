import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { supabaseAdmin } from "../lib/supabase-admin";
import { AdminAuthError, bearerToken, hasRole as hasRoleOrThrow, verifyAdminToken } from "../lib/admin-auth";

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

function toTRPCError(e: unknown): TRPCError {
  if (e instanceof AdminAuthError) {
    const internal = e.code === "NOT_CONFIGURED" || e.code === "ROLE_CHECK_FAILED";
    return new TRPCError({ code: internal ? "INTERNAL_SERVER_ERROR" : "UNAUTHORIZED", message: e.message });
  }
  return e instanceof TRPCError ? e : new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: (e as Error).message });
}

async function hasRole(client: NonNullable<typeof supabaseAdmin>, userId: string, role: "rider" | "driver" | "admin"): Promise<boolean> {
  try {
    return await hasRoleOrThrow(client, userId, role);
  } catch (e) {
    throw toTRPCError(e);
  }
}

// Admin-only procedure: verifies the caller's Supabase session token belongs
// to a user holding the 'admin' role before allowing access to service-role-key queries.
export const adminProcedure = publicProcedure.use(async ({ ctx, next }) => {
  let adminUserId: string;
  try {
    ({ adminUserId } = await verifyAdminToken(supabaseAdmin, bearerToken(ctx.req.headers.get("authorization"))));
  } catch (e) {
    throw toTRPCError(e);
  }

  return next({ ctx: { ...ctx, adminUserId, supabaseAdmin: supabaseAdmin! } });
});

// Authenticated procedure: verifies the caller's Supabase session token and
// resolves their own user id server-side — for routes that must act as "the
// logged-in user" with elevated (service-role) database access, without
// trusting a client-supplied user id. Used by payments.wallet.credit, which
// must credit exactly the caller's own wallet after re-verifying a payment,
// never a wallet id the client hands it.
export const authedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!supabaseAdmin) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "This feature is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.",
    });
  }

  const authHeader = ctx.req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing session token." });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired session." });
  }

  return next({ ctx: { ...ctx, userId: userData.user.id as string, supabaseAdmin } });
});

// Driver-only procedure: verifies the caller's Supabase session token belongs to a
// user holding the 'driver' role (see user_roles — a rider can hold this alongside
// 'rider'), and resolves their own drivers.id server-side — driver verification
// writes must never trust a client-supplied driverId. This is the sole entry point
// for the driver-verification engine (backend/services/verification/), which is
// itself the only code path allowed to write drivers.verificationStatus.
export const driverProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!supabaseAdmin) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Driver verification is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.",
    });
  }

  const authHeader = ctx.req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing session token." });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired session." });
  }

  if (!(await hasRole(supabaseAdmin, userData.user.id, "driver"))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "This account does not have a driver profile." });
  }

  const { data: driverRow, error: driverError } = await supabaseAdmin
    .from("drivers")
    .select("id")
    .eq("userId", userData.user.id)
    .single();

  if (driverError || !driverRow) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No driver profile found for this account." });
  }

  return next({
    ctx: {
      ...ctx,
      driverId: driverRow.id as string,
      driverUserId: userData.user.id as string,
      authToken: token,
      supabaseAdmin,
    },
  });
});