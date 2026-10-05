import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminAuthErrorCode = "NOT_CONFIGURED" | "MISSING_TOKEN" | "INVALID_SESSION" | "NOT_ADMIN" | "ROLE_CHECK_FAILED";

export class AdminAuthError extends Error {
  constructor(public readonly code: AdminAuthErrorCode, message: string) {
    super(message);
    this.name = "AdminAuthError";
  }
}

// Checks the user_roles table (see database/schemas/supabase-schema-user-roles.sql)
// rather than users.role, since an account can now hold more than one role — e.g.
// an existing rider who also registered as a driver. users.role is left as each
// account's default/primary experience and is never treated as an exhaustive list
// of what that account is allowed to do.
export async function hasRole(client: SupabaseClient, userId: string, role: "rider" | "driver" | "admin"): Promise<boolean> {
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("userId", userId)
    .eq("role", role)
    .maybeSingle();

  // A genuine query failure (e.g. the user_roles migration hasn't been run yet, so
  // the table doesn't exist) must not be swallowed as "role not found" — that would
  // reject every driver/admin with a misleading "this account does not have a driver
  // profile" instead of surfacing the real, fixable cause.
  if (error) {
    throw new AdminAuthError(
      "ROLE_CHECK_FAILED",
      `Could not verify account role (${error.message}). Has the user_roles migration been run?`
    );
  }

  return !!data;
}

export function bearerToken(authorizationHeader: string | null | undefined): string {
  const header = authorizationHeader ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
}

// Shared by adminProcedure (tRPC) and the agent-admin resolve endpoint (Hono), so
// "is this a real human admin" is decided in exactly one place.
export async function verifyAdminToken(client: SupabaseClient | null, token: string): Promise<{ adminUserId: string }> {
  if (!client) {
    throw new AdminAuthError("NOT_CONFIGURED", "Admin features are not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.");
  }
  if (!token) {
    throw new AdminAuthError("MISSING_TOKEN", "Missing admin session token.");
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new AdminAuthError("INVALID_SESSION", "Invalid or expired session.");
  }

  if (!(await hasRole(client, data.user.id, "admin"))) {
    throw new AdminAuthError("NOT_ADMIN", "This account does not have admin access.");
  }

  return { adminUserId: data.user.id };
}
