import { TRPCError } from "@trpc/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Abuse limits, counted in the database (rate_limit_hit, see
// supabase/migrations/20261009000100_account_deletion.sql) because serverless
// functions share no memory — a counter held in one instance would stop nobody.
//
// Fails OPEN: if the counter itself can't be reached, the request goes through
// and the failure is logged. A broken limiter must never stop a rider booking
// a ride or a driver getting paid.
//
// The numbers are technical guards against scripts and loops, not business
// rules; they sit with the routes that use them and are easy to change.
export async function enforceRateLimit(
  db: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number,
  message = "Too many requests. Please wait a little and try again."
): Promise<void> {
  const { data, error } = await db.rpc("rate_limit_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error(`Rate limiter unavailable for "${key}", letting the request through: ${error.message}`);
    return;
  }

  if (data === false) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message });
  }
}
