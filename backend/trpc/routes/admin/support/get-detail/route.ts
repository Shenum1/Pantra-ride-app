import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

export default adminProcedure
  .input(z.object({ ticketId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    const { data: ticket, error: ticketError } = await db
      .from("support_tickets")
      .select("*")
      .eq("id", input.ticketId)
      .single();

    if (ticketError || !ticket) throw new Error("Ticket not found.");

    const [messagesRes, eventsRes] = await Promise.all([
      db
        .from("support_ticket_messages")
        .select("id, senderType, senderId, text, createdAt")
        .eq("ticketId", input.ticketId)
        .order("createdAt", { ascending: true }),
      db
        .from("support_ticket_events")
        .select("id, actorType, eventType, fromStatus, toStatus, reason, createdAt")
        .eq("ticketId", input.ticketId)
        .order("createdAt", { ascending: false }),
    ]);

    return {
      ticket,
      messages: messagesRes.data ?? [],
      events: eventsRes.data ?? [],
    };
  });
