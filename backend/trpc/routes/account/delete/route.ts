import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure } from "../../../create-context";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { reportServerError } from "../../../../lib/error-reporting";

// Deletes the signed-in user's account: every personal detail is erased in one
// database transaction (anonymise_account), then the files they uploaded are
// removed from storage. Wallet, payout, refund and ride-fare records stay,
// no longer tied to a real person — see supabase/migrations/20261009000100_account_deletion.sql.
//
// Refuses (PRECONDITION_FAILED, message "ACCOUNT_DELETION_BLOCKED:CODE,CODE")
// while the account has a trip in progress, money in the wallet, a payout or
// refund on its way, or is an admin account.
export default authedProcedure
  .input(z.object({ confirm: z.literal("DELETE") }))
  .mutation(async ({ ctx }) => {
    const db = ctx.supabaseAdmin;
    await enforceRateLimit(db, `account-delete:${ctx.userId}`, 5, 3600);

    const { data, error } = await db.rpc("anonymise_account", { p_user_id: ctx.userId });
    if (error) {
      if (error.message.includes("ACCOUNT_DELETION_BLOCKED")) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: error.message.slice(error.message.indexOf("ACCOUNT_DELETION_BLOCKED")),
        });
      }
      if (error.message.includes("ACCOUNT_NOT_FOUND")) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This account no longer exists." });
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    // Past this point the account is already erased and locked, so a storage
    // problem is reported (someone must clear the files by hand) but does not
    // fail the request: the person asked to be deleted, and they are.
    const result = (data ?? {}) as { driverId?: string | null; documentPaths?: string[] };
    try {
      const documentPaths = [...(result.documentPaths ?? [])];
      if (result.driverId) {
        const { data: leftovers } = await db.storage.from("documents").list(`drivers/${result.driverId}`);
        for (const file of leftovers ?? []) documentPaths.push(`drivers/${result.driverId}/${file.name}`);
      }
      if (documentPaths.length > 0) {
        const { error: removeError } = await db.storage.from("documents").remove([...new Set(documentPaths)]);
        if (removeError) throw removeError;
      }

      const avatarPaths: string[] = [];
      const { data: avatars } = await db.storage.from("avatars").list(`users/${ctx.userId}`);
      for (const file of avatars ?? []) avatarPaths.push(`users/${ctx.userId}/${file.name}`);
      if (result.driverId) avatarPaths.push(`drivers/${result.driverId}.jpg`);
      if (avatarPaths.length > 0) {
        const { error: removeError } = await db.storage.from("avatars").remove(avatarPaths);
        if (removeError) throw removeError;
      }
    } catch (e) {
      console.error(`Account ${ctx.userId} was deleted but its stored files could NOT all be removed:`, e);
      reportServerError(e, { where: "account.delete storage cleanup", userId: ctx.userId });
    }

    return { deleted: true as const };
  });
