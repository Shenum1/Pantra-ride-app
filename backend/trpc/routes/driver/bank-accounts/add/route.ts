import { z } from "zod";
import { driverProcedure } from "../../../../create-context";
import { enforceRateLimit } from "../../../../../lib/rate-limit";
import { encryptAccountNumber, accountNumberLast4 } from "../../../../../lib/bank-account-crypto";
import { resolveBankCode } from "../../../../../lib/nigerian-banks";
import { createPaystackTransferRecipient } from "../../../../../lib/payout-provider";
import { resolveFlutterwaveAccountName } from "../../../../../lib/flutterwave-payout-provider";
import { DRIVER_PAYOUT_CONFIG } from "../../../../../../lib/pricing-config";

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
    // Each attempt can call the bank-name lookup, so cap guessing at account numbers.
    await enforceRateLimit(db, `bank-add:${ctx.driverUserId}`, 10, 3600);

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

    // Best-effort: front-load the active payout provider's account
    // verification (Paystack: recipient creation; Flutterwave:
    // /v3/accounts/resolve — it has no recipient object) so a later
    // automatic payout doesn't need to do it on the critical path. Never
    // blocks saving the bank account — if the bank name doesn't resolve to a
    // known code, or the provider rejects it, the account is still saved and
    // automatic payout initiation will retry this same verification later,
    // falling back to manual_review if it still can't be done then.
    // bankCode (the cached column) always holds the PAYSTACK code; Flutterwave
    // gets its own code, resolved separately — the two differ for several
    // banks (see backend/lib/nigerian-banks.ts).
    const bankCode = resolveBankCode(input.bankName, "paystack");
    if (bankCode) {
      try {
        if (DRIVER_PAYOUT_CONFIG.provider === "flutterwave") {
          const flutterwaveBankCode = resolveBankCode(input.bankName, "flutterwave") as string;
          const resolved = await resolveFlutterwaveAccountName({ accountNumber: input.accountNumber, bankCode: flutterwaveBankCode });
          await db
            .from("driver_bank_accounts")
            .update(resolved.ok ? { bankCode, recipientVerifiedAt: new Date().toISOString() } : { bankCode })
            .eq("id", data.id);
        } else {
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
        }
      } catch (verificationError) {
        console.error(`bank account ${data.id}: provider account verification failed (will retry at payout time):`, verificationError);
      }
    }

    return data;
  });
