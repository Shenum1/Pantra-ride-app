import { z } from "zod";
import { authedProcedure } from "../../../create-context";

export default authedProcedure
  .input(z.object({ ticketId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    const { data: ticket, error: ticketError } = await db
      .from("support_tickets")
      .select("id, filedByUserId, subject, category, status, priority, createdAt, updatedAt")
      .eq("id", input.ticketId)
      .single();

    if (ticketError || !ticket) throw new Error("Ticket not found.");
    if (ticket.filedByUserId !== ctx.userId) throw new Error("Not authorized to view this ticket.");

    const { data: messages, error: messagesError } = await db
      .from("support_ticket_messages")
      .select("id, senderType, text, createdAt")
      .eq("ticketId", input.ticketId)
      .order("createdAt", { ascending: true });

    if (messagesError) throw new Error(messagesError.message);

    return { ticket, messages: messages ?? [] };
  });
