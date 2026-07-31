import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["processing", "completed", "failed"]),
      failureReason: z.string().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    const updates: Record<string, unknown> = { status: input.status };

    if (input.status === "completed" || input.status === "failed") {
      updates.completedAt = new Date().toISOString();
    }

    if (input.status === "failed" && input.failureReason) {
      updates.failureReason = input.failureReason;
    }

    const { error } = await db.from("driver_payouts").update(updates).eq("id", input.id);
    if (error) throw new Error(error.message);

    return { success: true };
  });
