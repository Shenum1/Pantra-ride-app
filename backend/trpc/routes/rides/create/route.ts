import { z } from "zod";
import { authedProcedure } from "../../../create-context";
import { getServerDirections } from "../../../../lib/directions-service";
import { calculateFareBreakdown, applyRideDiscounts } from "../../../../../lib/fare-calculator";
import { calculateSurgeMultiplier, SurgeConfig } from "../../../../../lib/surge-calculator";
import { calculateTrafficMultiplier, TrafficRule } from "../../../../../lib/traffic-multiplier";
import { TIER_RATES, TierId, TierRatesTable, ZONE_FEES, SHARED_RIDE_DISCOUNT_MULTIPLIER } from "../../../../../lib/pricing-config";

// The single write path for creating a ride. Financial/distance fields are
// NEVER accepted from the client — every one of them is derived here from
// trusted server-side inputs (the Google Directions API — no fallback; see
// backend/lib/directions-service.ts — plus DB-backed pricing config and live
// driver/ride counts). See
// database/schemas/supabase-schema-rides-server-authoritative-fare.sql,
// which drops the old client-facing "Rider can create rides" INSERT policy
// so this route (running under the service-role client) is the only way a
// row can land in `rides` at all.
//
// If getServerDirections can't establish a real road distance (Directions
// unreachable/unconfigured), it throws rather than returning an estimate —
// this route lets that propagate, so no ride is ever created from an
// unverified distance. The rider sees a "please try again" alert (both
// existing call sites already handle a thrown error from requestRide()).
// Exported so tests can assert directly that the input schema has no
// fare/fee/distance/duration field at all — see
// testing/integration/trpc-router.test.ts.
export const rideCreateInputSchema = z.object({
  pickupLocation: z.object({ latitude: z.number(), longitude: z.number() }),
  dropoffLocation: z.object({ latitude: z.number(), longitude: z.number() }),
  pickupAddress: z.string().min(1),
  dropoffAddress: z.string().min(1),
  rideType: z.enum(["standard", "comfort", "xl"]).default("standard"),
  isPriority: z.boolean().default(false),
  isShared: z.boolean().default(false),
  sharedWith: z.array(z.string()).optional(),
  paymentMethod: z.string().default("cash"),
  promoCode: z.string().optional(),
  scheduledTime: z.string().datetime().optional(),
  passengerName: z.string().optional(),
  passengerPhone: z.string().optional(),
  // Airport-surcharge style zone fee — whitelist-clamped below against
  // ZONE_FEES, never trusted verbatim. There's no server-side geofencing
  // signal (reverse-geocoding pickup/dropoff against known airport
  // coordinates) yet to derive this independently — flagged as real
  // follow-up work, not invented here.
  zoneFee: z.number().min(0).optional(),
});

const VALID_ZONE_FEES = new Set<number>([
  0,
  ZONE_FEES.airportPickup,
  ZONE_FEES.airportDropoff,
  ZONE_FEES.airportPickup + ZONE_FEES.airportDropoff,
]);

export default authedProcedure.input(rideCreateInputSchema).mutation(async ({ ctx, input }) => {
  const db = ctx.supabaseAdmin;

  const [tierRow, surgeRow, trafficRows, priorityRow, onlineDriversRes, pendingRidesRes] = await Promise.all([
    db.from("pricing_tier_config").select("id, base, perKm, perMin, minFare, bookingFee, serviceFee").eq("id", input.rideType).maybeSingle(),
    db.from("surge_config").select("minMultiplier, maxMultiplier, highDemandRatio, lowDemandRatio, isEnabled, lowAcceptanceThreshold, lowAcceptanceBonus").limit(1).maybeSingle(),
    db.from("traffic_multiplier_rules").select("id, label, daysOfWeek, startMinute, endMinute, startDate, endDate, multiplier, isEnabled").eq("isEnabled", true),
    db.from("pricing_priority_config").select("fee, isEnabled").limit(1).maybeSingle(),
    db.from("drivers").select("id", { count: "exact", head: true }).eq("isOnline", true),
    db.from("rides").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const tierRates: TierRatesTable = { ...TIER_RATES };
  if (tierRow.data) {
    const t = tierRow.data;
    tierRates[input.rideType as TierId] = {
      id: t.id,
      name: TIER_RATES[input.rideType as TierId].name,
      base: t.base,
      perKm: t.perKm,
      perMin: t.perMin,
      minFare: t.minFare,
      bookingFee: t.bookingFee,
      serviceFee: t.serviceFee,
    };
  }

  const directions = await getServerDirections(input.pickupLocation, input.dropoffLocation);
  const distanceKm = directions.distanceMeters / 1000;
  const durationMin = directions.durationSeconds / 60;

  const surgeConfig: SurgeConfig = surgeRow.data
    ? {
        minMultiplier: surgeRow.data.minMultiplier,
        maxMultiplier: surgeRow.data.maxMultiplier,
        highDemandRatio: surgeRow.data.highDemandRatio,
        lowDemandRatio: surgeRow.data.lowDemandRatio,
        isEnabled: surgeRow.data.isEnabled,
        lowAcceptanceThreshold: surgeRow.data.lowAcceptanceThreshold ?? undefined,
        lowAcceptanceBonus: surgeRow.data.lowAcceptanceBonus ?? undefined,
      }
    : { minMultiplier: 1, maxMultiplier: 2.5, highDemandRatio: 1.5, lowDemandRatio: 0.3, isEnabled: true };

  const surgeMultiplier = calculateSurgeMultiplier(onlineDriversRes.count ?? 0, pendingRidesRes.count ?? 0, surgeConfig);

  const trafficRules: TrafficRule[] = (trafficRows.data ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    daysOfWeek: r.daysOfWeek,
    startMinute: r.startMinute,
    endMinute: r.endMinute,
    startDate: r.startDate,
    endDate: r.endDate,
    multiplier: r.multiplier,
    isEnabled: r.isEnabled,
  }));
  const trafficMultiplier = calculateTrafficMultiplier(new Date(), trafficRules);

  const priorityFeeEnabled = priorityRow.data?.isEnabled ?? true;
  const priorityFee = input.isPriority && priorityFeeEnabled ? (priorityRow.data?.fee ?? 500) : 0;

  const zoneFee = input.zoneFee != null && VALID_ZONE_FEES.has(input.zoneFee) ? input.zoneFee : 0;

  const breakdown = calculateFareBreakdown(
    distanceKm,
    durationMin,
    input.rideType,
    surgeMultiplier,
    zoneFee,
    trafficMultiplier,
    priorityFee,
    tierRates
  );

  // Discounts (shared-ride + promo) apply to the metered subtotal only,
  // mirroring the same pipeline the client used to run — see
  // applyRideDiscounts' own doc comment for why flat fees are excluded.
  let discountedMetered = breakdown.meteredSubtotal;
  let promoId: string | null = null;

  if (input.isShared) {
    discountedMetered = applyRideDiscounts(discountedMetered, input.rideType, {
      sharedRideDiscountMultiplier: SHARED_RIDE_DISCOUNT_MULTIPLIER,
    }, tierRates);
  }

  if (input.promoCode) {
    const nowIso = new Date().toISOString();
    const { data: promo } = await db
      .from("promotions")
      .select("id, discountPercentage, maxDiscountNGN, maxUses, usedCount, isActive, validFrom, validUntil")
      .eq("code", input.promoCode)
      .maybeSingle();

    if (promo && promo.isActive && promo.validFrom <= nowIso && promo.validUntil > nowIso && (promo.maxUses == null || promo.usedCount < promo.maxUses)) {
      const { data: alreadyUsed } = await db
        .from("user_promo_uses")
        .select("id")
        .eq("userId", ctx.userId)
        .eq("promoId", promo.id)
        .maybeSingle();

      if (!alreadyUsed) {
        discountedMetered = applyRideDiscounts(discountedMetered, input.rideType, {
          promo: { discountPercentage: promo.discountPercentage, maxDiscountNGN: promo.maxDiscountNGN },
        }, tierRates);
        promoId = promo.id as string;
      }
    }
  }

  const fare = discountedMetered + breakdown.bookingFee + breakdown.serviceFee + zoneFee + priorityFee;

  const insertPayload = {
    userId: ctx.userId,
    pickupLocation: {
      lat: input.pickupLocation.latitude,
      lng: input.pickupLocation.longitude,
      latitude: input.pickupLocation.latitude,
      longitude: input.pickupLocation.longitude,
      address: input.pickupAddress,
    },
    dropoffLocation: {
      lat: input.dropoffLocation.latitude,
      lng: input.dropoffLocation.longitude,
      latitude: input.dropoffLocation.latitude,
      longitude: input.dropoffLocation.longitude,
      address: input.dropoffAddress,
    },
    pickupAddress: input.pickupAddress,
    dropoffAddress: input.dropoffAddress,
    rideType: input.rideType,
    status: "pending",
    paymentStatus: "unpaid",
    fareSource: directions.fareSource,
    fare,
    baseFare: breakdown.base,
    minFare: tierRates[input.rideType as TierId].minFare,
    maxFare: fare,
    bookingFee: breakdown.bookingFee,
    serviceFee: breakdown.serviceFee,
    zoneFee,
    isPriority: input.isPriority,
    priorityFee,
    distance: Math.round(distanceKm * 100) / 100,
    duration: Math.round(durationMin),
    trackingStage: "searching",
    statusText: "Looking for a nearby driver",
    paymentMethod: input.paymentMethod,
    promoCode: promoId ? input.promoCode : null,
    isShared: input.isShared,
    sharedWith: input.isShared && input.sharedWith && input.sharedWith.length > 0 ? input.sharedWith : null,
    scheduledTime: input.scheduledTime ?? null,
    passengerName: input.passengerName ?? null,
    passengerPhone: input.passengerPhone ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { data: created, error } = await db.from("rides").insert(insertPayload).select("*").single();
  if (error) throw new Error(error.message);

  if (promoId) {
    await db.from("user_promo_uses").insert({ userId: ctx.userId, promoId, rideId: created.id });
    await db.rpc("increment_promo_use", { promo_id: promoId });
  }

  return created;
});
