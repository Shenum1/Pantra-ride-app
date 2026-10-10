import { z } from "zod";
import { authedProcedure } from "../../../create-context";
import { enforceRateLimit } from "../../../../lib/rate-limit";

export default authedProcedure
  .input(
    z.object({
      subject: z.string().min(1),
      category: z.enum(["ride_issue", "payment_issue", "account_issue", "safety", "other"]).default("other"),
      message: z.string().min(1),
      rideId: z.string().uuid().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    await enforceRateLimit(db, `support-ticket:${ctx.userId}`, 5, 3600);

    const { data: profile, error: profileError } = await db
      .from("users")
      .select("uid, displayName, email, role")
      .eq("uid", ctx.userId)
      .single();

    if (profileError || !profile) throw new Error("Account not found.");
    if (profile.role !== "rider" && profile.role !== "driver") {
      throw new Error("Only riders and drivers can file support tickets.");
    }

    let driverId: string | null = null;
    if (profile.role === "driver") {
      const { data: driver } = await db.from("drivers").select("id").eq("userId", ctx.userId).single();
      driverId = driver?.id ?? null;
    }

    // support_ticket_messages.senderType / support_ticket_events.actorType only
    // accept 'user' | 'driver' | 'admin' — users.role says 'rider', not 'user' —
    // so this maps between the two rather than passing profile.role straight
    // through, which would violate the check constraint for every rider ticket.
    const senderType = profile.role === "driver" ? "driver" : "user";

    const { data: ticket, error: ticketError } = await db
      .from("support_tickets")
      .insert({
        filedByUserId: ctx.userId,
        filedByRole: profile.role,
        filedByName: profile.displayName || profile.email || ctx.userId,
        driverId,
        rideId: input.rideId ?? null,
        subject: input.subject,
        category: input.category,
      })
      .select("id, status")
      .single();

    if (ticketError || !ticket) throw new Error(ticketError?.message ?? "Could not create ticket.");

    const { error: messageError } = await db.from("support_ticket_messages").insert({
      ticketId: ticket.id,
      senderType,
      senderId: ctx.userId,
      text: input.message,
    });
    if (messageError) throw new Error(messageError.message);

    const { error: eventError } = await db.from("support_ticket_events").insert({
      ticketId: ticket.id,
      actorType: senderType,
      actorId: ctx.userId,
      eventType: "CREATED",
      toStatus: "open",
    });
    if (eventError) throw new Error(eventError.message);

    return { ticketId: ticket.id };
  });
