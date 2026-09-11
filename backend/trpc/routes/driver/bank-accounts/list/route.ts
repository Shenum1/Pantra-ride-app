import { driverProcedure } from "../../../../create-context";

// Never returns the encrypted blob or plaintext account number — only what a
// driver needs to recognize their own saved accounts. Direct client RLS
// access to driver_bank_accounts was revoked entirely (see
// supabase-schema-driver-bank-accounts-encryption.sql); this route is the
// only remaining read path.
export default driverProcedure.query(async ({ ctx }) => {
  const { data, error } = await ctx.supabaseAdmin
    .from("driver_bank_accounts")
    .select("id, bankName, accountName, accountNumberLast4, isDefault, createdAt")
    .eq("driverId", ctx.driverId)
    .order("createdAt", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
});
