import { z } from "zod";
import { authedProcedure } from "../../../../create-context";
import { verifyPaystackTransaction, verifyFlutterwaveTransaction } from "../../../../../lib/payment-providers";

// The only path allowed to credit a wallet from a real payment.
// add_wallet_transaction (database/schemas/supabase-schema-wallet.sql)
// rejects add_money/refund/cashback/credit transactions from a plain
// authenticated client — this route re-verifies the payment with the
// provider server-side, uses the provider's CONFIRMED amount (never the
// client's), and credits via the service-role client, which the RPC's
// restriction exempts.
export default authedProcedure
  .input(
    z.object({
      gateway: z.enum(["paystack", "flutterwave"]),
      reference: z.string().min(1),
      paymentMethodId: z.string().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const verification =
      input.gateway === "paystack"
        ? await verifyPaystackTransaction(input.reference)
        : await verifyFlutterwaveTransaction(input.reference);

    if (!verification.success || verification.amount === null) {
      return { status: false as const, message: verification.message || "Payment could not be verified." };
    }

    const { data, error } = await ctx.supabaseAdmin.rpc("add_wallet_transaction", {
      p_user_id: ctx.userId,
      p_type: "add_money",
      p_amount: verification.amount,
      p_description: "Added money to wallet",
      p_status: "completed",
      p_ride_id: null,
      p_payment_method_id: input.paymentMethodId ?? input.gateway,
      p_reference: input.reference,
      p_metadata: null,
    });

    if (error) {
      console.error("Wallet credit failed after verified payment:", error);
      return { status: false as const, message: error.message };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return { status: true as const, message: "Wallet credited", amount: verification.amount, transaction: row };
  });
