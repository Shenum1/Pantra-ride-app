import { z } from "zod";
import { authedProcedure } from "../../../../create-context";
import { generatePaymentReference } from "../../../../../lib/payment-providers";
import { WALLET_TOPUP_CONFIG } from "../../../../../../lib/pricing-config";

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY ?? "";

export default authedProcedure
  .input(
    z.object({
      amount: z.number().finite().positive(),
      email: z.string().email(),
      phone_number: z.string().optional(),
      name: z.string().optional(),
      redirect_url: z.string().optional(),
      meta: z.record(z.string(), z.any()).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    if (!FLUTTERWAVE_SECRET_KEY) {
      console.warn("⚠️ FLUTTERWAVE_SECRET_KEY is not configured on the server");
      return {
        status: "error" as const,
        message: "Flutterwave is not configured. Please add FLUTTERWAVE_SECRET_KEY to the server environment.",
      };
    }

    const amount = Math.round(input.amount * 100) / 100;
    if (amount < WALLET_TOPUP_CONFIG.minAmount || amount > WALLET_TOPUP_CONFIG.maxAmount) {
      return {
        status: "error" as const,
        message: `Amount must be between ₦${WALLET_TOPUP_CONFIG.minAmount.toLocaleString()} and ₦${WALLET_TOPUP_CONFIG.maxAmount.toLocaleString()}.`,
      };
    }

    // Generated server-side, never client-supplied.
    const tx_ref = generatePaymentReference();

    const { error: intentError } = await ctx.supabaseAdmin.from("payment_intents").insert({
      userId: ctx.userId,
      provider: "flutterwave",
      reference: tx_ref,
      purpose: "wallet_funding",
      expectedAmount: amount,
      currency: "NGN",
      status: "initialized",
    });

    if (intentError) {
      console.error("Failed to create payment intent:", intentError);
      return { status: "error" as const, message: "Could not start this payment. Please try again." };
    }

    try {
      const response = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref,
          amount,
          currency: "NGN",
          redirect_url: input.redirect_url || "https://rork.app/payment-callback",
          payment_options: "card,banktransfer,ussd,mobilemoney",
          customer: {
            email: input.email,
            phonenumber: input.phone_number,
            name: input.name || "Customer",
          },
          customizations: {
            title: "Ride Payment",
            description: "Payment for ride service",
            logo: "https://rork.app/logo.png",
          },
          meta: input.meta,
        }),
      });

      const result = await response.json();

      if (result.status !== "success") {
        console.error("Flutterwave initialization failed:", result);
        await ctx.supabaseAdmin.from("payment_intents").update({ status: "cancelled" }).eq("reference", tx_ref);
        return {
          status: "error" as const,
          message: result.message || "Failed to initialize payment",
        };
      }

      return {
        status: "success" as const,
        message: "Payment initialized successfully",
        data: result.data,
      };
    } catch (error) {
      console.error("Error initializing Flutterwave payment:", error);
      await ctx.supabaseAdmin.from("payment_intents").update({ status: "cancelled" }).eq("reference", tx_ref);
      return {
        status: "error" as const,
        message: "Network error while contacting Flutterwave.",
      };
    }
  });
