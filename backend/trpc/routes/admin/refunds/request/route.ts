import { z } from "zod";
import { adminProcedure } from "../../../../create-context";
import { generateRefundReference, initiateRefund } from "../../../../../lib/refund-processor";

// The ONLY way a refund can be created. Server-authoritative throughout:
// the refundable amount is re-derived here (never trusted from the client),
// ownership/eligibility is re-checked, and the actual amount-cap enforcement
// is the DB-level refund_intents_check_amount trigger (advisory-locked,
// exactly like driver_payouts_check_balance) — this route's own check is a
// friendly early error, not the real guard.
export default adminProcedure
  .input(
    z.object({
      idempotencyKey: z.string().min(1),
      originalPaymentType: z.enum(["wallet_topup", "ride_wallet_payment"]),
      paymentIntentId: z.string().uuid().optional(),
      rideId: z.string().uuid().optional(),
      amount: z.number().finite().positive(),
      reason: z.string().min(1),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    // A duplicate submission with the same idempotencyKey (admin double-click,
    // client retry) returns the existing row instead of creating a second
    // refund — never re-executes a completed/failed one.
    const { data: existing, error: existingError } = await db
      .from("refund_intents")
      .select("id, status")
      .eq("idempotencyKey", input.idempotencyKey)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      if (existing.status === "requested") {
        await initiateRefund(db, existing.id);
      }
      const { data: refreshed, error: refreshError } = await db.from("refund_intents").select("*").eq("id", existing.id).single();
      if (refreshError) throw new Error(refreshError.message);
      return refreshed;
    }

    if (input.originalPaymentType === "wallet_topup" && !input.paymentIntentId) {
      throw new Error("paymentIntentId is required for a wallet_topup refund.");
    }
    if (input.originalPaymentType === "ride_wallet_payment" && !input.rideId) {
      throw new Error("rideId is required for a ride_wallet_payment refund.");
    }

    const amount = Math.round(input.amount * 100) / 100;

    let userId: string;
    let provider: "paystack" | "flutterwave" | null = null;
    let originalAmount: number;
    let currency = "NGN";
    let originalWalletTransactionId: string | null = null;

    if (input.originalPaymentType === "wallet_topup") {
      const { data: intent, error } = await db
        .from("payment_intents")
        .select("id, userId, provider, expectedAmount, currency, status")
        .eq("id", input.paymentIntentId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!intent) throw new Error("Payment not found.");
      if (intent.status !== "successful") throw new Error(`This payment is not eligible for refund (status: ${intent.status}).`);

      userId = intent.userId;
      provider = intent.provider;
      originalAmount = intent.expectedAmount;
      currency = intent.currency;
    } else {
      const { data: ride, error: rideError } = await db.from("rides").select("id, userId").eq("id", input.rideId).maybeSingle();
      if (rideError) throw new Error(rideError.message);
      if (!ride) throw new Error("Ride not found.");

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
        throw new Error("This ride was not paid from wallet balance and is not refundable through this system (cash/unpaid rides have no captured transaction to reverse).");
      }

      userId = ride.userId;
      originalAmount = Math.abs(Number(walletTxn.amount));
      originalWalletTransactionId = walletTxn.id;
    }

    if (amount > originalAmount) {
      throw new Error(`Refund amount (${amount}) cannot exceed the original payment amount (${originalAmount}).`);
    }

    const { data: refund, error: insertError } = await db
      .from("refund_intents")
      .insert({
        originalPaymentType: input.originalPaymentType,
        paymentIntentId: input.originalPaymentType === "wallet_topup" ? input.paymentIntentId : null,
        rideId: input.originalPaymentType === "ride_wallet_payment" ? input.rideId : null,
        originalWalletTransactionId,
        userId,
        provider,
        refundReference: generateRefundReference(),
        originalAmount,
        amount,
        currency,
        reason: input.reason,
        refundType: amount === originalAmount ? "full" : "partial",
        requestedBy: ctx.adminUserId,
        idempotencyKey: input.idempotencyKey,
      })
      .select("*")
      .single();

    if (insertError) {
      // The amount-cap trigger (refund_intents_check_amount) raises here if
      // this would exceed the refundable balance — including the
      // concurrent-partial-refunds case, since it runs under an advisory
      // lock keyed to the original payment.
      throw new Error(insertError.message);
    }

    await initiateRefund(db, refund.id);

    const { data: finalRefund, error: refetchError } = await db.from("refund_intents").select("*").eq("id", refund.id).single();
    if (refetchError) throw new Error(refetchError.message);

    return finalRefund;
  });
