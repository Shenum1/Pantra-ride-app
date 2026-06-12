import { z } from "zod";
import { adminProcedure } from "../../../create-context";

const DOCUMENTS_BUCKET = "documents";

export default adminProcedure
  .input(z.object({ status: z.enum(["pending", "approved", "rejected", "all"]).optional() }).optional())
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const statusFilter = input?.status ?? "pending";

    let query = db
      .from("driver_documents")
      .select("id, driverId, type, documentUrl, status, uploadedAt, reviewedAt, rejectionReason")
      .order("uploadedAt", { ascending: false })
      .limit(100);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data: docs, error } = await query;
    if (error) throw new Error(error.message);

    const driverIds = Array.from(new Set((docs ?? []).map((d) => d.driverId).filter(Boolean)));

    const driversRes = driverIds.length
      ? await db.from("drivers").select("id, name, email").in("id", driverIds)
      : { data: [] as { id: string; name: string | null; email: string | null }[] };

    const driverMap = new Map((driversRes.data ?? []).map((d) => [d.id, d]));

    const documents = await Promise.all(
      (docs ?? []).map(async (doc) => {
        const driver = driverMap.get(doc.driverId);
        let signedUrl: string | null = null;

        if (doc.documentUrl && doc.documentUrl !== "system_generated") {
          const { data: signed } = await db.storage
            .from(DOCUMENTS_BUCKET)
            .createSignedUrl(doc.documentUrl, 3600);
          signedUrl = signed?.signedUrl ?? null;
        }

        return {
          id: doc.id,
          driverId: doc.driverId,
          driverName: driver?.name || driver?.email || doc.driverId,
          driverEmail: driver?.email ?? "",
          type: doc.type,
          status: doc.status,
          uploadedAt: doc.uploadedAt,
          reviewedAt: doc.reviewedAt,
          rejectionReason: doc.rejectionReason,
          signedUrl,
        };
      })
    );

    return { documents };
  });
