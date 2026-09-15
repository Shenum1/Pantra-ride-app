import { z } from "zod";
import { authedProcedure } from "../../../../create-context";
import { generatePaymentReference } from "../../../../../lib/payment-providers";
import { WALLET_TOPUP_CONFIG } from "../../../../../../lib/pricing-config";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY ?? "";

export default authedProcedure
  .input(
    z.object({
      amount: z.number().finite().positive(),
      email: z.string().email(),
      callback_url: z.string().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    if (!PAYSTACK_SECRET_KEY) {
      console.warn("⚠️ PAYSTACK_SECRET_KEY is not configured on the server");
      return {
        status: false,
        message: "Paystack is not configured. Please add PAYSTACK_SECRET_KEY to the server environment.",
      };
    }

    // Round to kobo precision (2dp) — the amount we persist as
    // payment_intents.expectedAmount and later validate the provider's
    // confirmation against must match how it's actually stored/compared.
    const amount = Math.round(input.amount * 100) / 100;
    if (amount < WALLET_TOPUP_CONFIG.minAmount || amount > WALLET_TOPUP_CONFIG.maxAmount) {
      return {
        status: false,
        message: `Amount must be between ₦${WALLET_TOPUP_CONFIG.minAmount.toLocaleString()} and ₦${WALLET_TOPUP_CONFIG.maxAmount.toLocaleString()}.`,
      };
    }

    // Generated server-side, never client-supplied — a rider can no longer
    // choose or predict their own payment reference.
    const reference = generatePaymentReference();
    const amountInKobo = Math.round(amount * 100);

    const { error: intentError } = await ctx.supabaseAdmin.from("payment_intents").insert({
      userId: ctx.userId,
      provider: "paystack",
      reference,
      purpose: "wallet_funding",
      expectedAmount: amount,
      currency: "NGN",
      status: "initialized",
    });

    if (intentError) {
      console.error("Failed to create payment intent:", intentError);
      return { status: false, message: "Could not start this payment. Please try again." };
    }

    try {
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: input.email,
          amount: amountInKobo,
          reference,
          currency: "NGN",
          callback_url: input.callback_url,
          metadata: input.metadata,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.status) {
        console.error("Paystack initialization failed:", result);
        // The intent never reached the provider as a real charge attempt —
        // 'cancelled' (Pantra's own administrative marker), not 'failed'
        // (reserved for a provider-CONFIRMED declined charge).
        await ctx.supabaseAdmin.from("payment_intents").update({ status: "cancelled" }).eq("reference", reference);
        return {
          status: false,
          message: result.message || "Failed to initialize payment",
        };
      }

      return {
        status: true,
        message: "Transaction initialized successfully",
        data: result.data,
      };
    } catch (error) {
      console.error("Error initializing Paystack transaction:", error);
      await ctx.supabaseAdmin.from("payment_intents").update({ status: "cancelled" }).eq("reference", reference);
      return {
        status: false,
        message: "Network error while contacting Paystack.",
      };
    }
  });
