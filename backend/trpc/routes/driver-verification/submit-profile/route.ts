import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { driverProcedure } from "../../../create-context";
import { validateDriverProfileFormat } from "@/lib/nigerian-format-validators";
import { runProfileFormatCheck, recomputeDriverVerificationStatus } from "@/backend/services/verification/engine";

const inputSchema = z.object({
  fullLegalName: z.string().min(1),
  dateOfBirth: z.string(), // ISO date, e.g. '1990-01-01'
  operatingState: z.string().min(1),
  vehicleCategory: z.enum(["standard", "comfort", "xl"]),
  licenseNumber: z.string().min(1),
  licenseCategory: z.string().min(1),
  licenseIssueDate: z.string(),
  licenseExpiryDate: z.string(),
  vehiclePlateNumber: z.string().min(1),
  vehicleMake: z.string().min(1),
  vehicleModel: z.string().min(1),
  vehicleYear: z.number().int(),
  vehicleColor: z.string().min(1),
  vehicleVin: z.string().min(1),
  vehicleEngineNumber: z.string().min(1),
});

export default driverProcedure.input(inputSchema).mutation(async ({ ctx, input }) => {
  const db = ctx.supabaseAdmin;

  const formatResult = validateDriverProfileFormat({
    fullLegalName: input.fullLegalName,
    dateOfBirth: new Date(input.dateOfBirth),
    operatingState: input.operatingState,
    licenseNumber: input.licenseNumber,
    licenseIssueDate: new Date(input.licenseIssueDate),
    licenseExpiryDate: new Date(input.licenseExpiryDate),
    vehiclePlateNumber: input.vehiclePlateNumber,
    vehicleYear: input.vehicleYear,
    vehicleVin: input.vehicleVin,
    vehicleEngineNumber: input.vehicleEngineNumber,
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

  const { error: updateError } = await db
    .from("drivers")
    .update({
      fullLegalName: input.fullLegalName,
      dateOfBirth: input.dateOfBirth,
      operatingState: input.operatingState,
      vehicleCategory: input.vehicleCategory,
      licenseNumber: input.licenseNumber,
      licenseCategory: input.licenseCategory,
      licenseIssueDate: input.licenseIssueDate,
      licenseExpiryDate: input.licenseExpiryDate,
      vehiclePlateNumber: input.vehiclePlateNumber,
      vehicleVin: input.vehicleVin,
      vehicleEngineNumber: input.vehicleEngineNumber,
      // Mirrors the normalized columns above into the legacy `vehicle` jsonb blob
      // every existing rider-facing read site (getNearbyDrivers, dashboards, etc.)
      // still reads — this procedure is the single writer of both, so they can
      // never drift apart.
      vehicle: {
        ...(existing?.vehicle ?? {}),
        make: input.vehicleMake,
        model: input.vehicleModel,
        year: input.vehicleYear,
        color: input.vehicleColor,
        licensePlate: input.vehiclePlateNumber,
        type: input.vehicleCategory,
      },
    })
    .eq("id", ctx.driverId);

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
