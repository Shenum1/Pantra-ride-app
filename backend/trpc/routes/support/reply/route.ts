import { z } from "zod";
import { authedProcedure } from "../../../create-context";

export default authedProcedure
  .input(z.object({ ticketId: z.string().uuid(), text: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    const { data: ticket, error: ticketError } = await db
      .from("support_tickets")
      .select("id, filedByUserId, filedByRole, status")
      .eq("id", input.ticketId)
      .single();

    if (ticketError || !ticket) throw new Error("Ticket not found.");
    if (ticket.filedByUserId !== ctx.userId) throw new Error("Not authorized to reply to this ticket.");
    if (ticket.status === "closed") throw new Error("This ticket is closed.");

    await db.from("support_ticket_messages").insert({
      ticketId: input.ticketId,
      senderType: ticket.filedByRole,
      senderId: ctx.userId,
      text: input.text,
    });

    await db.from("support_ticket_events").insert({
      ticketId: input.ticketId,
      actorType: ticket.filedByRole,
      actorId: ctx.userId,
      eventType: "MESSAGE_SENT",
    });

    await db.from("support_tickets").update({ updatedAt: new Date().toISOString() }).eq("id", input.ticketId);

    return { success: true };
  });
