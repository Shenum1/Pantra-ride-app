import { z } from "zod";
import { driverProcedure } from "../../../../create-context";
import { encryptAccountNumber, accountNumberLast4 } from "../../../../../lib/bank-account-crypto";

export default driverProcedure
  .input(
    z.object({
      bankName: z.string().min(1),
      accountNumber: z.string().min(10).max(10),
      accountName: z.string().min(1),
      isDefault: z.boolean().default(false),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    if (input.isDefault) {
      await db.from("driver_bank_accounts").update({ isDefault: false }).eq("driverId", ctx.driverId);
    }

    const { data, error } = await db
      .from("driver_bank_accounts")
      .insert({
        driverId: ctx.driverId,
        bankName: input.bankName,
        accountName: input.accountName,
        accountNumberEncrypted: encryptAccountNumber(input.accountNumber),
        accountNumberLast4: accountNumberLast4(input.accountNumber),
        isDefault: input.isDefault,
      })
      .select("id, bankName, accountName, accountNumberLast4, isDefault, createdAt")
      .single();

    if (error) throw new Error(error.message);
    return data;
  });
