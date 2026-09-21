import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

const ALREADY_COUNTED_STATUSES = ["requested", "processing", "unknown", "completed"];

// Lets the admin-web refund form show a real refundable amount and refund
// history before submitting — never trusts a client-supplied refundable
// figure at request time (that route re-derives everything itself too).
export default adminProcedure
  .input(
    z.object({
      originalPaymentType: z.enum(["wallet_topup", "ride_wallet_payment"]),
      paymentIntentId: z.string().uuid().optional(),
      rideId: z.string().uuid().optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    if (input.originalPaymentType === "wallet_topup") {
      if (!input.paymentIntentId) throw new Error("paymentIntentId is required for a wallet_topup refund.");

      const { data: intent, error } = await db
        .from("payment_intents")
        .select("id, userId, provider, expectedAmount, currency, status")
        .eq("id", input.paymentIntentId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!intent) return { eligible: false, reason: "Payment not found." };
      if (intent.status !== "successful") {
        return { eligible: false, reason: `This payment is not eligible for refund (status: ${intent.status}).` };
      }

      const { data: previousRefunds, error: refundsError } = await db
        .from("refund_intents")
        .select("id, amount, status, reason, createdAt")
        .eq("paymentIntentId", input.paymentIntentId)
        .order("createdAt", { ascending: false });
      if (refundsError) throw new Error(refundsError.message);

      const alreadyRefunded = (previousRefunds ?? [])
        .filter((r) => ALREADY_COUNTED_STATUSES.includes(r.status))
        .reduce((sum, r) => sum + Number(r.amount), 0);
      const refundable = Math.max(0, Math.round((intent.expectedAmount - alreadyRefunded) * 100) / 100);

      return {
        eligible: refundable > 0,
        reason: refundable > 0 ? null : "This payment has already been fully refunded.",
        userId: intent.userId,
        provider: intent.provider,
        originalAmount: intent.expectedAmount,
        currency: intent.currency,
        alreadyRefunded,
        refundable,
        previousRefunds: previousRefunds ?? [],
      };
    }

    // ride_wallet_payment
    if (!input.rideId) throw new Error("rideId is required for a ride_wallet_payment refund.");

    const { data: ride, error: rideError } = await db.from("rides").select("id, userId, fare").eq("id", input.rideId).maybeSingle();
    if (rideError) throw new Error(rideError.message);
    if (!ride) return { eligible: false, reason: "Ride not found." };

    const { data: walletTxn, error: walletTxnError } = await db
      .from("wallet_transactions")
      .select("id, amount, status")
      .eq("rideId", input.rideId)
      .eq("type", "ride_payment")
      .eq("status", "completed")
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (walletTxnError) throw new Error(walletTxnError.message);

    if (!walletTxn) {
      // This is exactly how cash (and today, card — not yet implemented)
      // rides are excluded: only a ride actually paid FROM wallet balance
      // produces this row at all.
      return { eligible: false, reason: "This ride was not paid from wallet balance and is not refundable through this system." };
    }

    const originalAmount = Math.abs(Number(walletTxn.amount));

    const { data: previousRefunds, error: refundsError } = await db
      .from("refund_intents")
      .select("id, amount, status, reason, createdAt")
      .eq("rideId", input.rideId)
      .order("createdAt", { ascending: false });
    if (refundsError) throw new Error(refundsError.message);

    const alreadyRefunded = (previousRefunds ?? [])
      .filter((r) => ALREADY_COUNTED_STATUSES.includes(r.status))
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const refundable = Math.max(0, Math.round((originalAmount - alreadyRefunded) * 100) / 100);

    return {
      eligible: refundable > 0,
      reason: refundable > 0 ? null : "This ride payment has already been fully refunded.",
      userId: ride.userId,
      provider: null,
      originalAmount,
      currency: "NGN",
      alreadyRefunded,
      refundable,
      previousRefunds: previousRefunds ?? [],
    };
  });
