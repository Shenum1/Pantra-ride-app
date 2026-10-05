import { defineReadTool, defineWriteTool, pick } from "../types";
import {
  getSupportTicket,
  getSupportTicketInput,
  listSupportTickets,
  listSupportTicketsInput,
  replyToSupportTicket,
  replyToSupportTicketInput,
  updateSupportTicketStatus,
  updateSupportTicketStatusInput,
} from "../../services/admin/support";

export const listSupportTicketsTool = defineReadTool({
  name: "list_support_tickets",
  description:
    "List support tickets filed by riders and drivers, most recently updated first. Each has subject, category, status (open, in_progress, resolved, closed), priority (low, normal, high, urgent), who filed it and their role. Returns {tickets, total}. Use get_support_ticket to read the conversation. Read-only.",
  inputSchema: listSupportTicketsInput,
  run: (db, input) => listSupportTickets(db, input),
});

export const getSupportTicketTool = defineReadTool({
  name: "get_support_ticket",
  description:
    "Get one support ticket with its full message thread (oldest first, each message's senderType is user, driver or admin) and its audit trail of status/priority changes. Read before replying. Read-only.",
  inputSchema: getSupportTicketInput,
  run: (db, input) => getSupportTicket(db, input),
});

export const replyToSupportTicketTool = defineWriteTool({
  name: "reply_to_support_ticket",
  description:
    "Send a reply from Pantra Support to the rider or driver who filed a ticket. The text is delivered verbatim in-app and as a push notification, and an open ticket automatically moves to in_progress. REQUIRES HUMAN APPROVAL: returns 202 with an actionId; nothing is sent until an admin approves. Write in a clear, polite, professional tone and never promise refunds, credits or outcomes Pantra hasn't confirmed.",
  inputSchema: replyToSupportTicketInput,
  summarize: (input) => `Reply to ticket ${input.ticketId}: "${input.text.length > 80 ? `${input.text.slice(0, 80)}…` : input.text}"`,
  run: (db, input, actorAdminId) => replyToSupportTicket(db, actorAdminId, input),
});

export const updateSupportTicketStatusTool = defineWriteTool({
  name: "update_support_ticket_status",
  description:
    "Change a support ticket's status (open, in_progress, resolved, closed) and/or priority (low, normal, high, urgent). Provide at least one of status or priority. The change is recorded in the ticket's audit trail with the reason. REQUIRES HUMAN APPROVAL: returns 202 with an actionId; nothing changes until an admin approves.",
  inputSchema: updateSupportTicketStatusInput,
  validate: (input) =>
    input.status === undefined && input.priority === undefined ? "Provide at least one of status or priority." : undefined,
  summarize: (input) =>
    [input.status && `status → ${input.status}`, input.priority && `priority → ${input.priority}`]
      .filter(Boolean)
      .join(", ") + ` on ticket ${input.ticketId}`,
  snapshot: async (db, input) => {
    const { data, error } = await db.from("support_tickets").select("status, priority").eq("id", input.ticketId).single();
    if (error || !data) throw new Error("Ticket not found.");
    return pick(data, [input.status !== undefined && "status", input.priority !== undefined && "priority"].filter(Boolean) as string[]);
  },
  run: (db, input, actorAdminId) => updateSupportTicketStatus(db, actorAdminId, input),
});
