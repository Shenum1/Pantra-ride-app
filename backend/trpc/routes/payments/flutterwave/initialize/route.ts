import { z } from "zod";
import { authedProcedure } from "../../../../create-context";
import { createFlutterwaveCheckout } from "../../../../../lib/flutterwave-checkout";
import { WALLET_TOPUP_CONFIG } from "../../../../../../lib/pricing-config";

// A rider's wallet top-up checkout. Driver commission payments use the same
// checkout (backend/lib/flutterwave-checkout.ts) via driver.commission.pay.
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
    const amount = Math.round(input.amount * 100) / 100;
    if (amount < WALLET_TOPUP_CONFIG.minAmount || amount > WALLET_TOPUP_CONFIG.maxAmount) {
      return {
        status: "error" as const,
        message: `Amount must be between ₦${WALLET_TOPUP_CONFIG.minAmount.toLocaleString()} and ₦${WALLET_TOPUP_CONFIG.maxAmount.toLocaleString()}.`,
      };
    }

    return createFlutterwaveCheckout({
      supabaseAdmin: ctx.supabaseAdmin,
      userId: ctx.userId,
      purpose: "wallet_funding",
      amount,
      customer: { email: input.email, name: input.name, phone: input.phone_number },
      returnUrl: input.redirect_url,
      title: "Pantra Wallet",
      description: "Add money to your Pantra wallet",
      meta: input.meta,
    });
  });
