import { randomUUID } from "node:crypto";
import { z } from "zod";
import { driverProcedure } from "../../../create-context";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Called by the driver app right before it marks a ride 'completed' — see
// hooks/useDriverStore.ts's updateRideStatus. Confirms the ride is actually
// paid for and sets rides.paymentStatus='paid', which the rides_settle_guard
// trigger (database/schemas/supabase-schema-ride-payment-status.sql) then
// requires before it will let the ride's status become 'completed'.
//
// This has to be a backend route rather than a direct client write: for a
// wallet-method ride, debiting the RIDER's wallet requires the rider's own
// auth identity per add_wallet_transaction's authorization check — the
// driver's client session can't call that RPC on the rider's behalf. Here,
// running as the service role after verifying this driver actually owns the
// ride, is the one place allowed to do it.
export default driverProcedure
  .input(z.object({ rideId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    const { data: ride, error: rideError } = await db
      .from("rides")
      .select("id, userId, driverId, fare, pointsValueNGN, paymentMethod, status, paymentStatus")
      .eq("id", input.rideId)
      .single();

    if (rideError || !ride) {
      return { status: false as const, message: "Ride not found." };
    }

    if (ride.driverId !== ctx.driverId) {
      return { status: false as const, message: "This ride is not assigned to you." };
    }

    if (ride.status === "completed" || ride.status === "cancelled") {
      return { status: false as const, message: "This ride has already been settled." };
    }

    // Payment is only ever confirmed for a trip that is actually under way. Without this a
    // driver could accept a ride, confirm payment (a wallet debit) and complete it without
    // driving it. The database enforces the same rule (rides_enforce_status_machine).
    if (ride.status !== "in-progress") {
      return { status: false as const, message: "The trip has not started yet, so payment cannot be confirmed." };
    }

    if (ride.paymentStatus === "paid") {
      return { status: true as const, message: "Already paid." };
    }

    // rides.create stores the plain method ('cash' / 'wallet' — see
    // resolveRidePaymentMethod there). The saved-method-id lookup below only
    // exists for rides booked before that change, which stored the id of
    // the rider's payment_methods row instead.
    let isWallet = ride.paymentMethod === "wallet";
    if (!isWallet && ride.paymentMethod && UUID_RE.test(ride.paymentMethod)) {
      const { data: method } = await db
        .from("payment_methods")
        .select("type")
        .eq("id", ride.paymentMethod)
        .eq("userId", ride.userId)
        .maybeSingle();
      isWallet = method?.type === "wallet";
    }

    // What this call took from the rider's wallet, so it can be given back if the ride can't be marked paid.
    let debitedAmount = 0;

    if (isWallet) {
      // Reward points paid part of the fare (Pantra covers it), so the wallet only pays the rest.
      const amountDue = Math.max(0, Math.round(((ride.fare ?? 0) - (ride.pointsValueNGN ?? 0)) * 100) / 100);
      const { error: debitError } = await db.rpc("add_wallet_transaction", {
        p_user_id: ride.userId,
        p_type: "ride_payment",
        p_amount: -amountDue,
        p_description: "Ride payment",
        p_status: "completed",
        p_ride_id: ride.id,
        p_payment_method_id: ride.paymentMethod,
        p_reference: null,
        p_metadata: null,
      });

      if (debitError) {
        const message = debitError.message?.toLowerCase().includes("insufficient balance")
          ? "Rider's wallet balance is insufficient to pay for this ride."
          : debitError.message;
        return { status: false as const, message };
      }
      debitedAmount = amountDue;
    }
    // Cash rides: the driver confirming completion is treated as payment
    // received (the rider paid the driver directly, in person) — there is
    // no rider-side debit to perform here. The platform's commission on
    // this ride is NOT forgiven, though: once paymentStatus becomes 'paid'
    // here, rides_settle_trigger() (fired when status next moves to
    // 'completed') records a matching debt against the driver in
    // driver_commission_ledger — see
    // supabase-schema-cash-commission-ledger.sql. Card rides: not yet
    // built as a real ride-time charge; cardless is now the committed
    // architecture (see supabase-schema-payment-methods-cardless-deprecation.sql),
    // so this branch is expected to stay dead rather than get built out.

    const { error: updateError } = await db
      .from("rides")
      .update({ paymentStatus: "paid" })
      .eq("id", ride.id);

    if (updateError) {
      // The wallet was already debited but the ride can't be marked paid (for example it was cancelled
      // at the same moment). Give the money back so the rider isn't charged for a payment that did not
      // go through; a retry debits again. A fresh reference each time so two reversals never dedupe.
      if (debitedAmount > 0) {
        const { error: reversalError } = await db.rpc("add_wallet_transaction", {
          p_user_id: ride.userId,
          p_type: "refund",
          p_amount: debitedAmount,
          p_description: "Ride payment reversed: it could not be completed",
          p_status: "completed",
          p_ride_id: ride.id,
          p_payment_method_id: null,
          p_reference: `ride-payment-reversal:${ride.id}:${randomUUID()}`,
          p_metadata: { reason: "payment_confirmation_failed", error: updateError.message },
        });
        if (reversalError) {
          // Loud on purpose: the rider is out this money until someone returns it.
          console.error(
            `rides.confirmPayment: ride ${ride.id} could not be marked paid AND the wallet debit of ${debitedAmount} for user ${ride.userId} could NOT be reversed: ${reversalError.message}`
          );
        }
      }
      return { status: false as const, message: updateError.message };
    }

    return { status: true as const, message: "Payment confirmed." };
  });
