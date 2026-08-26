import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      ticketId: z.string().uuid(),
      status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      reason: z.string().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    const { data: ticket, error: ticketError } = await db
      .from("support_tickets")
      .select("status, priority")
      .eq("id", input.ticketId)
      .single();

    if (ticketError || !ticket) throw new Error("Ticket not found.");

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (input.status) updates.status = input.status;
    if (input.priority) updates.priority = input.priority;

    const { error: updateError } = await db.from("support_tickets").update(updates).eq("id", input.ticketId);
    if (updateError) throw new Error(updateError.message);

    if (input.status && input.status !== ticket.status) {
      await db.from("support_ticket_events").insert({
        ticketId: input.ticketId,
        actorType: "admin",
        actorId: ctx.adminUserId,
        eventType: "STATUS_CHANGED",
        fromStatus: ticket.status,
        toStatus: input.status,
        reason: input.reason ?? null,
      });
    }

    if (input.priority && input.priority !== ticket.priority) {
      await db.from("support_ticket_events").insert({
        ticketId: input.ticketId,
        actorType: "admin",
        actorId: ctx.adminUserId,
        eventType: "PRIORITY_CHANGED",
        reason: input.reason ?? null,
        metadata: { fromPriority: ticket.priority, toPriority: input.priority },
      });
    }

    return { success: true };
  });
