import { z } from "zod";
import { adminProcedure } from "../../../../create-context";
import { listActions } from "../../../../../agent-admin/hitl";

export default adminProcedure
  .input(
    z.object({
      status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXECUTED", "EXECUTION_FAILED"]).optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    })
  )
  .query(({ ctx, input }) => listActions(ctx.supabaseAdmin, input));
