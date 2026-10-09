import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure } from "../../../create-context";

// Starts the server-side watch clock for a task. rewards.claimTask refuses a
// video claim until the required time has passed on the server's clock — see
// supabase/migrations/20261008000900_task_watch_timer.sql. Calling this again
// never resets the clock.
export default authedProcedure
  .input(z.object({ taskId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabaseAdmin.rpc("start_reward_task", {
      p_user_id: ctx.userId,
      p_task_id: input.taskId,
    });

    if (error) {
      if (error.message.includes("TASK_UNAVAILABLE")) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This task is no longer available." });
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    const row = (Array.isArray(data) ? data[0] : data) as { required_seconds: number; remaining_seconds: number };
    return { requiredSeconds: row.required_seconds, remainingSeconds: row.remaining_seconds };
  });
