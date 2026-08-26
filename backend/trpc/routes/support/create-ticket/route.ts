import { z } from "zod";
import { authedProcedure } from "../../../create-context";

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

    await db.from("support_ticket_messages").insert({
      ticketId: ticket.id,
      senderType: profile.role,
      senderId: ctx.userId,
      text: input.message,
    });

    await db.from("support_ticket_events").insert({
      ticketId: ticket.id,
      actorType: profile.role,
      actorId: ctx.userId,
      eventType: "CREATED",
      toStatus: "open",
    });

    return { ticketId: ticket.id };
  });
