import { z } from "zod";
import { driverProcedure } from "../../../../create-context";
import { encryptAccountNumber, accountNumberLast4 } from "../../../../../lib/bank-account-crypto";
import { resolveBankCode } from "../../../../../lib/nigerian-banks";
import { createPaystackTransferRecipient } from "../../../../../lib/payout-provider";

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

    // Best-effort: front-load Paystack recipient creation (which itself
    // validates the account number/bank code pair) so a later automatic
    // payout doesn't need to do it on the critical path. Never blocks saving
    // the bank account — if the bank name doesn't resolve to a known code,
    // or Paystack rejects it, the account is still saved and automatic
    // payout initiation will retry this same resolution later, falling back
    // to manual_review if it still can't be done then.
    const bankCode = resolveBankCode(input.bankName);
    if (bankCode) {
      try {
        const recipient = await createPaystackTransferRecipient({
          accountNumber: input.accountNumber,
          bankCode,
          accountName: input.accountName,
        });
        if (recipient.ok && recipient.recipientCode) {
          await db
            .from("driver_bank_accounts")
            .update({ bankCode, paystackRecipientCode: recipient.recipientCode, recipientVerifiedAt: new Date().toISOString() })
            .eq("id", data.id);
        } else {
          await db.from("driver_bank_accounts").update({ bankCode }).eq("id", data.id);
        }
      } catch (recipientError) {
        console.error(`bank account ${data.id}: recipient pre-creation failed (will retry at payout time):`, recipientError);
      }
    }

    return data;
  });
