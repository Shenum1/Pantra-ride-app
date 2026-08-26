import { z } from "zod";
import { adminProcedure } from "../../../../create-context";
import { batchSendPush } from "../../../../lib/push-notify";

export default adminProcedure
  .input(z.object({ ticketId: z.string().uuid(), text: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    const { data: ticket, error: ticketError } = await db
      .from("support_tickets")
      .select("id, filedByUserId, filedByRole, driverId, status")
      .eq("id", input.ticketId)
      .single();

    if (ticketError || !ticket) throw new Error("Ticket not found.");

    await db.from("support_ticket_messages").insert({
      ticketId: input.ticketId,
      senderType: "admin",
      senderId: ctx.adminUserId,
      text: input.text,
    });

    await db.from("support_ticket_events").insert({
      ticketId: input.ticketId,
      actorType: "admin",
      actorId: ctx.adminUserId,
      eventType: "MESSAGE_SENT",
    });

    const nextStatus = ticket.status === "open" ? "in_progress" : ticket.status;
    await db.from("support_tickets").update({ updatedAt: new Date().toISOString(), status: nextStatus }).eq("id", input.ticketId);

    if (nextStatus !== ticket.status) {
      await db.from("support_ticket_events").insert({
        ticketId: input.ticketId,
        actorType: "system",
        eventType: "STATUS_CHANGED",
        fromStatus: ticket.status,
        toStatus: nextStatus,
        reason: "Auto-advanced on first admin reply",
      });
    }

    let pushToken: string | null = null;
    if (ticket.filedByRole === "driver" && ticket.driverId) {
      const { data: driver } = await db.from("drivers").select("pushToken").eq("id", ticket.driverId).single();
      pushToken = driver?.pushToken ?? null;
    } else {
      const { data: user } = await db.from("users").select("pushToken").eq("uid", ticket.filedByUserId).single();
      pushToken = user?.pushToken ?? null;
    }

    if (pushToken) {
      await batchSendPush([pushToken], "Support replied to your ticket", input.text.slice(0, 120), {
        type: "support_reply",
        ticketId: input.ticketId,
      });
    }

    return { success: true };
  });
