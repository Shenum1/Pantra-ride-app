import { z } from "zod";
import { adminProcedure } from "../../../../../create-context";

// Manual triage only — reconciliation never auto-resolves a record it
// creates; an admin always marks it resolved/ignored explicitly, with an
// optional note for the audit trail.
export default adminProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["resolved", "ignored"]),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { error } = await ctx.supabaseAdmin
      .from("payment_reconciliation_records")
      .update({
        reconciliationStatus: input.status,
        resolvedAt: new Date().toISOString(),
        notes: input.notes ?? null,
      })
      .eq("id", input.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });
