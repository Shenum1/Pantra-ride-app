import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { driverProcedure } from "../../../create-context";
import { validateDriverProfileFormat } from "@/lib/nigerian-format-validators";
import { runProfileFormatCheck, recomputeDriverVerificationStatus } from "@/backend/services/verification/engine";

// Registration saves the profile in two steps (operating state, then vehicle details),
// so every field is optional and only what is supplied is validated and written.
const inputSchema = z.object({
  operatingState: z.string().min(1).optional(),
  vehicleCategory: z.enum(["standard", "comfort", "xl"]).optional(),
  vehiclePlateNumber: z.string().min(1).optional(),
  vehicleMake: z.string().min(1).optional(),
  vehicleModel: z.string().min(1).optional(),
  vehicleYear: z.number().int().optional(),
  vehicleColor: z.string().min(1).optional(),
});

export default driverProcedure.input(inputSchema).mutation(async ({ ctx, input }) => {
  const db = ctx.supabaseAdmin;

  const formatResult = validateDriverProfileFormat({
    operatingState: input.operatingState,
    vehiclePlateNumber: input.vehiclePlateNumber,
    vehicleYear: input.vehicleYear,
    vehicleMake: input.vehicleMake,
    vehicleModel: input.vehicleModel,
    vehicleColor: input.vehicleColor,
  });

  if (!formatResult.valid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Profile format validation failed: ${JSON.stringify(formatResult.fieldErrors)}`,
    });
  }

  const { data: existing } = await db
    .from("drivers")
    .select("vehicle")
    .eq("id", ctx.driverId)
    .single();

  const columns: Record<string, unknown> = {};
  if (input.operatingState !== undefined) columns.operatingState = input.operatingState;
  if (input.vehicleCategory !== undefined) columns.vehicleCategory = input.vehicleCategory;
  if (input.vehiclePlateNumber !== undefined) columns.vehiclePlateNumber = input.vehiclePlateNumber;

  // Mirrors the normalized columns into the legacy `vehicle` jsonb blob every existing
  // rider-facing read site (getNearbyDrivers, ride progress, dashboards) still reads —
  // this procedure is the single writer of both, so they can never drift apart.
  const vehicle: Record<string, unknown> = { ...(existing?.vehicle ?? {}) };
  if (input.vehicleMake !== undefined) vehicle.make = input.vehicleMake;
  if (input.vehicleModel !== undefined) vehicle.model = input.vehicleModel;
  if (input.vehicleYear !== undefined) vehicle.year = input.vehicleYear;
  if (input.vehicleColor !== undefined) vehicle.color = input.vehicleColor;
  if (input.vehiclePlateNumber !== undefined) vehicle.licensePlate = input.vehiclePlateNumber;
  if (input.vehicleCategory !== undefined) vehicle.type = input.vehicleCategory;
  columns.vehicle = vehicle;

  const { error: updateError } = await db.from("drivers").update(columns).eq("id", ctx.driverId);
  if (updateError) throw new Error(updateError.message);

  await runProfileFormatCheck(db, ctx.driverId);
  await recomputeDriverVerificationStatus(db, ctx.driverId);

  const { data: updated } = await db
    .from("drivers")
    .select("verificationStatus")
    .eq("id", ctx.driverId)
    .single();

  return { success: true, verificationStatus: updated?.verificationStatus ?? "PENDING" };
});
