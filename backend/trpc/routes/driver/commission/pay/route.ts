import { z } from "zod";
import { driverProcedure } from "../../../../create-context";
import { getCashCommissionStatus } from "../../../../../lib/cash-commission";
import { createFlutterwaveCheckout } from "../../../../../lib/flutterwave-checkout";
import { WALLET_TOPUP_CONFIG } from "../../../../../../lib/pricing-config";

// Starts an in-app Flutterwave checkout for the driver's full outstanding
// cash commission. The amount is always computed here from the driver's
// current balance — never sent by the app. Once Flutterwave confirms the
// payment (webhook, or the app's own confirmation via
// payments.wallet.credit), processVerifiedPayment records it as a
// settlement against the driver's commission debt.
export default driverProcedure
  .input(z.object({ returnUrl: z.string().optional() }))
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const status = await getCashCommissionStatus(db, ctx.driverId);

    if (status.amountOwed <= 0) {
      return { status: "error" as const, message: "You don't owe any cash commission." };
    }
    if (status.amountOwed < WALLET_TOPUP_CONFIG.minAmount) {
      return {
        status: "error" as const,
        message: `₦${status.amountOwed.toLocaleString()} is below the ₦${WALLET_TOPUP_CONFIG.minAmount} minimum for an online payment — it will be cleared by your next wallet ride.`,
      };
    }

    const { data: driver, error: driverError } = await db
      .from("drivers")
      .select("name, email, phone")
      .eq("id", ctx.driverId)
      .maybeSingle<{ name: string | null; email: string | null; phone: string | null }>();
    if (driverError) throw new Error(driverError.message);
    if (!driver?.email) {
      return { status: "error" as const, message: "Add an email address to your driver profile to pay online." };
    }

    return createFlutterwaveCheckout({
      supabaseAdmin: db,
      userId: ctx.driverUserId,
      purpose: "commission_settlement",
      amount: status.amountOwed,
      customer: { email: driver.email, name: driver.name ?? undefined, phone: driver.phone ?? undefined },
      returnUrl: input.returnUrl,
      title: "Pantra Commission",
      description: "Pay the commission owed on your cash rides",
    });
  });
