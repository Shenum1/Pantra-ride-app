import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

export default adminProcedure
  .input(
    z
      .object({
        status: z.enum(["DOCUMENTS_SUBMITTED", "VERIFYING", "MANUAL_REVIEW", "all"]).optional(),
      })
      .optional()
  )
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const statusFilter = input?.status ?? "MANUAL_REVIEW";

    let query = db
      .from("drivers")
      .select(
        "id, name, email, fullLegalName, operatingState, vehicleCategory, verificationStatus, verificationProgress, verificationStatusUpdatedAt, rejectionReason"
      )
      .order("verificationStatusUpdatedAt", { ascending: false })
      .limit(100);

    if (statusFilter === "all") {
      query = query.in("verificationStatus", ["DOCUMENTS_SUBMITTED", "VERIFYING", "MANUAL_REVIEW", "REJECTED", "VERIFIED"]);
    } else {
      query = query.eq("verificationStatus", statusFilter);
    }

    const { data: drivers, error } = await query;
    if (error) throw new Error(error.message);

    return { drivers: drivers ?? [] };
  });
