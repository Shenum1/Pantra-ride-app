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
      .select("id, userId, driverId, fare, paymentMethod, status, paymentStatus")
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

    let isWallet = false;
    if (ride.paymentMethod && UUID_RE.test(ride.paymentMethod)) {
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
        p_amount: -(ride.fare ?? 0),
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
    // Cash and card rides: the driver confirming completion (or the — not
    // yet built — checkout charge, for card) is treated as payment
    // received, same as before this migration; only wallet rides had a
    // real debit to perform here.

    const { error: updateError } = await db
      .from("rides")
      .update({ paymentStatus: "paid" })
      .eq("id", ride.id);

    if (updateError) {
      return { status: false as const, message: updateError.message };
    }

    return { status: true as const, message: "Payment confirmed." };
  });
