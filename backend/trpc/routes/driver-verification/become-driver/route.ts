import { TRPCError } from "@trpc/server";
import { authedProcedure } from "../../../create-context";

// Lets an already-authenticated account (any existing role — normally a rider)
// start driver registration without creating a second account: it grants the
// 'driver' role (user_roles) and creates their drivers row, prefilled from their
// existing profile, so they land straight in the same driver-verification wizard
// every driver goes through (no shortcuts — see app/driver-verification/*). Uses
// authedProcedure, not driverProcedure, because at this point they don't have the
// driver role yet. Idempotent: calling it again for an existing driver is a no-op.
export default authedProcedure.mutation(async ({ ctx }) => {
  const { data: existingDriver } = await ctx.supabaseAdmin
    .from("drivers")
    .select("id")
    .eq("userId", ctx.userId)
    .maybeSingle();

  if (!existingDriver) {
    const { data: profile, error: profileError } = await ctx.supabaseAdmin
      .from("users")
      .select("displayName, email, phoneNumber")
      .eq("uid", ctx.userId)
      .single();

    if (profileError || !profile) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Could not find your account profile." });
    }

    const { error: insertError } = await ctx.supabaseAdmin.from("drivers").insert({
      userId: ctx.userId,
      name: profile.displayName ?? "",
      email: profile.email ?? "",
      phone: profile.phoneNumber ?? null,
      rating: null,
      isOnline: false,
      earnings: { today: 0, thisWeek: 0, thisMonth: 0, total: 0 },
    });

    if (insertError) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: insertError.message });
    }
  }

  const { error: roleError } = await ctx.supabaseAdmin
    .from("user_roles")
    .upsert({ userId: ctx.userId, role: "driver" }, { onConflict: "userId,role" });

  if (roleError) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: roleError.message });
  }

  return { success: true as const };
});
