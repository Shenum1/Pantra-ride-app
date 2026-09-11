import { driverProcedure } from "../../../../create-context";

// Replaces DriverWalletService.getPayouts' direct
// `driver_payouts.select('*, bankAccount:driver_bank_accounts(*)')` join,
// which breaks now that driver_bank_accounts has no client-facing RLS
// policy at all (see supabase-schema-driver-bank-accounts-encryption.sql).
// A driver only ever needs to recognize which saved account a payout is
// going to — last4 is enough, the encrypted blob/plaintext is never
// returned here either.
export default driverProcedure.query(async ({ ctx }) => {
  const db = ctx.supabaseAdmin;

  const { data: payouts, error } = await db
    .from("driver_payouts")
    .select("id, driverId, amount, bankAccountId, status, failureReason, requestedAt, completedAt")
    .eq("driverId", ctx.driverId)
    .order("requestedAt", { ascending: false });

  if (error) throw new Error(error.message);

  const bankAccountIds = [...new Set((payouts ?? []).map((p) => p.bankAccountId).filter(Boolean))];
  const bankRes =
    bankAccountIds.length > 0
      ? await db.from("driver_bank_accounts").select("id, bankName, accountName, accountNumberLast4").in("id", bankAccountIds)
      : { data: [] };

  const bankMap = new Map((bankRes.data ?? []).map((b) => [b.id, b]));

  return (payouts ?? []).map((p) => ({
    ...p,
    bankAccount: p.bankAccountId ? (bankMap.get(p.bankAccountId) ?? null) : null,
  }));
});
