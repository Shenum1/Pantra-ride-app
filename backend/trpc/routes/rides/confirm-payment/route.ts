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

    if (isWallet) {
      const { error: debitError } = await db.rpc("add_wallet_transaction", {
        p_user_id: ride.userId,
        p_type: "ride_payment",
        // Reward points paid part of the fare (Pantra covers it), so the wallet only pays the rest.
        p_amount: -Math.max(0, Math.round(((ride.fare ?? 0) - (ride.pointsValueNGN ?? 0)) * 100) / 100),
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
      return { status: false as const, message: updateError.message };
    }

    return { status: true as const, message: "Payment confirmed." };
  });
