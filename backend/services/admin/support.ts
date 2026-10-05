import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { batchSendPush } from "../../trpc/lib/push-notify";

const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const listSupportTicketsInput = z.object({
  status: z.enum(TICKET_STATUSES).optional().describe("Only return tickets in this status. Omit for all statuses."),
  priority: z.enum(TICKET_PRIORITIES).optional().describe("Only return tickets with this priority. Omit for all priorities."),
  limit: z.number().int().min(1).max(100).default(50).describe("Maximum number of tickets to return (1-100)."),
  offset: z.number().int().min(0).default(0).describe("Number of tickets to skip, for pagination."),
});

export async function listSupportTickets(db: SupabaseClient, input: z.infer<typeof listSupportTicketsInput>) {
  let query = db
    .from("support_tickets")
    .select(
      "id, filedByUserId, filedByRole, filedByName, subject, category, status, priority, createdAt, updatedAt",
      { count: "exact" }
    )
    .order("updatedAt", { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);

  if (input.status) query = query.eq("status", input.status);
  if (input.priority) query = query.eq("priority", input.priority);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  return { tickets: data ?? [], total: count ?? 0 };
}

export const getSupportTicketInput = z.object({
  ticketId: z.string().uuid().describe("UUID of the support ticket."),
});

export async function getSupportTicket(db: SupabaseClient, input: z.infer<typeof getSupportTicketInput>) {
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

  return { ticket, messages: messagesRes.data ?? [], events: eventsRes.data ?? [] };
}

export const replyToSupportTicketInput = z.object({
  ticketId: z.string().uuid().describe("UUID of the support ticket to reply to."),
  text: z
    .string()
    .min(1)
    .describe("The reply message, sent verbatim to the rider or driver who filed the ticket (also delivered as a push notification)."),
});

export async function replyToSupportTicket(
  db: SupabaseClient,
  actorAdminId: string,
  input: z.infer<typeof replyToSupportTicketInput>
) {
  const { data: ticket, error: ticketError } = await db
    .from("support_tickets")
    .select("id, filedByUserId, filedByRole, driverId, status")
    .eq("id", input.ticketId)
    .single();

  if (ticketError || !ticket) throw new Error("Ticket not found.");

  await db.from("support_ticket_messages").insert({
    ticketId: input.ticketId,
    senderType: "admin",
    senderId: actorAdminId,
    text: input.text,
  });

  await db.from("support_ticket_events").insert({
    ticketId: input.ticketId,
    actorType: "admin",
    actorId: actorAdminId,
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
}

export const updateSupportTicketStatusInput = z.object({
  ticketId: z.string().uuid().describe("UUID of the support ticket."),
  status: z.enum(TICKET_STATUSES).optional().describe("New ticket status. Omit to leave unchanged."),
  priority: z.enum(TICKET_PRIORITIES).optional().describe("New ticket priority. Omit to leave unchanged."),
  reason: z.string().optional().describe("Short reason recorded in the ticket's audit trail."),
});

export async function updateSupportTicketStatus(
  db: SupabaseClient,
  actorAdminId: string,
  input: z.infer<typeof updateSupportTicketStatusInput>
) {
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
      actorId: actorAdminId,
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
      actorId: actorAdminId,
      eventType: "PRIORITY_CHANGED",
      reason: input.reason ?? null,
      metadata: { fromPriority: ticket.priority, toPriority: input.priority },
    });
  }

  return { success: true };
}
