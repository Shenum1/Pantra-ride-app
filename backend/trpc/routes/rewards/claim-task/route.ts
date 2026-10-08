import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure } from "../../../create-context";

const CLAIM_ERRORS: Record<string, { code: "NOT_FOUND" | "CONFLICT" | "PRECONDITION_FAILED"; message: string }> = {
  TASK_UNAVAILABLE: { code: "NOT_FOUND", message: "This task is no longer available." },
  TASK_ALREADY_CLAIMED: { code: "CONFLICT", message: "You have already claimed this reward" },
  TASK_FULLY_CLAIMED: { code: "CONFLICT", message: "This reward has been fully claimed." },
  TASK_NOT_WATCHED: { code: "PRECONDITION_FAILED", message: "Watch the video for the full time before claiming." },
};

// The only path that credits points for a video/share task. The amount comes
// from reward_tasks and every limit is enforced inside claim_reward_task, using
// ctx.userId from the verified session token — never a client-supplied amount
// or user id. See supabase/migrations/20261008000800_points_lockdown.sql.
export default authedProcedure
  .input(z.object({ taskId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabaseAdmin.rpc("claim_reward_task", {
      p_user_id: ctx.userId,
      p_task_id: input.taskId,
    });

    if (error) {
      const known = Object.entries(CLAIM_ERRORS).find(([marker]) => error.message.includes(marker));
      if (known) throw new TRPCError(known[1]);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    return { pointsEarned: data as number };
  });
