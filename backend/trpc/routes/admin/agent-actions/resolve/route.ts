import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure } from "../../../../create-context";
import { AgentActionConflictError, AgentActionNotFoundError, resolveAction } from "../../../../../agent-admin/hitl";

// Same resolve path as POST /api/v1/agent-admin/actions/:id/resolve — the
// admin-web Agent queue page uses this one, with the admin's own session.
export default adminProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["APPROVED", "REJECTED"]),
      note: z.string().max(2000).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    try {
      return { action: await resolveAction(ctx.supabaseAdmin, input.id, input.decision, ctx.adminUserId, input.note) };
    } catch (e) {
      if (e instanceof AgentActionNotFoundError) throw new TRPCError({ code: "NOT_FOUND", message: e.message });
      if (e instanceof AgentActionConflictError) throw new TRPCError({ code: "CONFLICT", message: e.message });
      throw e;
    }
  });
