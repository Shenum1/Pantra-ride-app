import { z } from "zod";
import { adminProcedure } from "../../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      status: z.enum(["open", "resolved", "ignored"]).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    })
  )
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    let query = db
      .from("payment_reconciliation_records")
      .select(
        "id, provider, reference, expectedAmount, providerAmount, currency, pantraStatus, providerStatus, mismatchType, reconciliationStatus, detectedAt, resolvedAt, notes",
        { count: "exact" }
      )
      .order("detectedAt", { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    if (input.status) query = query.eq("reconciliationStatus", input.status);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    return { records: data ?? [], total: count ?? 0 };
  });
