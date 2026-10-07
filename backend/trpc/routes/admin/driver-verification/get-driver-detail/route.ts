import { adminProcedure } from "../../../../create-context";
import { getDriverVerificationDetail, getDriverVerificationDetailInput } from "../../../../../services/admin/driver-verification";
import { recordAdminAccess } from "../../../../../lib/admin-access-log";

export default adminProcedure
  .input(getDriverVerificationDetailInput)
  .query(async ({ ctx, input }) => {
    const detail = await getDriverVerificationDetail(ctx.supabaseAdmin, input);
    // Logged only after a successful load (a "Driver not found." throw above
    // exposed nothing). No PII in metadata — counts only.
    await recordAdminAccess(ctx.supabaseAdmin, {
      adminUserId: ctx.adminUserId,
      action: "view_driver_verification_detail",
      subjectType: "driver",
      subjectId: input.driverId,
      metadata: { documentCount: detail.documents.length, signedUrlsIssued: detail.documents.filter((d) => !!d.signedUrl).length },
    });
    return detail;
  });
