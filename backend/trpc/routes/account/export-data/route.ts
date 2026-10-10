import { TRPCError } from "@trpc/server";
import { authedProcedure } from "../../../create-context";
import { enforceRateLimit } from "../../../../lib/rate-limit";

// "Download my data": everything Pantra holds about the signed-in user, as one
// JSON document. Reads only the caller's own rows, never anyone else's
// personal details (a trip lists the driver by id, not by name or phone), and
// leaves out secrets and technical tokens (push tokens, the encrypted bank
// account number — only its last four digits are included).
//
// If any part cannot be read the whole export fails: a silently incomplete
// copy of someone's data is worse than telling them to try again.

const ROW_LIMIT = 10000;

type Row = Record<string, unknown>;

function without(rows: Row[] | null, ...keys: string[]): Row[] {
  return (rows ?? []).map((row) => {
    const copy = { ...row };
    for (const key of keys) delete copy[key];
    return copy;
  });
}

export default authedProcedure.query(async ({ ctx }) => {
  const db = ctx.supabaseAdmin;
  const userId = ctx.userId;
  await enforceRateLimit(db, `account-export:${userId}`, 3, 3600);

  const fail = (what: string, message: string): never => {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Could not read your ${what}: ${message}` });
  };

  async function mine(table: string, column: string, value: string, order = "createdAt"): Promise<Row[]> {
    const { data, error } = await db
      .from(table)
      .select("*")
      .eq(column, value)
      .order(order, { ascending: true })
      .limit(ROW_LIMIT);
    if (error) fail(table.replace(/_/g, " "), error.message);
    return (data ?? []) as Row[];
  }

  const [
    profile, preferences, savedLocations, familyMembers, paymentMethods, wallet, walletTransactions,
    pointsTransactions, policyAcceptances, promoUses, paymentIntents, refunds, ridesAsRider, ratingsGiven,
    tipsGiven, ratingsFromDrivers, tickets, conversations,
  ] = await Promise.all([
    mine("users", "uid", userId),
    mine("rider_preferences", "userId", userId, "updatedAt"),
    mine("saved_locations", "userId", userId),
    mine("family_members", "userId", userId),
    mine("payment_methods", "userId", userId),
    mine("wallets", "userId", userId),
    mine("wallet_transactions", "userId", userId),
    mine("points_transactions", "userId", userId),
    mine("policy_acceptances", "userId", userId, "acceptedAt"),
    mine("user_promo_uses", "userId", userId, "usedAt"),
    mine("payment_intents", "userId", userId),
    mine("refund_intents", "userId", userId),
    mine("rides", "userId", userId),
    mine("ratings", "userId", userId),
    mine("tips", "riderId", userId),
    mine("driver_ratings_of_riders", "userId", userId),
    mine("support_tickets", "filedByUserId", userId),
    mine("conversations", "userId", userId),
  ]);

  const ticketIds = tickets.map((t) => t.id as string);
  const conversationIds = conversations.map((c) => c.id as string);
  const [ticketMessages, chatMessages] = await Promise.all([
    ticketIds.length
      ? db.from("support_ticket_messages").select("*").in("ticketId", ticketIds).order("createdAt").limit(ROW_LIMIT)
      : Promise.resolve({ data: [] as Row[], error: null }),
    conversationIds.length
      ? db.from("messages").select("*").in("conversationId", conversationIds).order("createdAt").limit(ROW_LIMIT)
      : Promise.resolve({ data: [] as Row[], error: null }),
  ]);
  if (ticketMessages.error) fail("support messages", ticketMessages.error.message);
  if (chatMessages.error) fail("chat messages", chatMessages.error.message);

  // Driver side, only for accounts that are drivers.
  let driver: Record<string, unknown> | null = null;
  const { data: driverRow, error: driverError } = await db.from("drivers").select("*").eq("userId", userId).maybeSingle();
  if (driverError) fail("driver profile", driverError.message);

  if (driverRow) {
    const driverId = driverRow.id as string;
    const [documents, bankAccounts, payouts, commissionLedger, ridesAsDriver, tipsReceived, ratingsReceived, ratingsOfRiders] =
      await Promise.all([
        mine("driver_documents", "driverId", driverId),
        mine("driver_bank_accounts", "driverId", driverId),
        mine("driver_payouts", "driverId", driverId, "requestedAt"),
        mine("driver_commission_ledger", "driverId", driverId),
        mine("rides", "driverId", driverId),
        mine("tips", "driverId", driverId),
        mine("ratings", "driverId", driverId),
        mine("driver_ratings_of_riders", "driverId", driverId),
      ]);

    driver = {
      profile: without([driverRow as Row], "pushToken")[0],
      // Document files are not included here, only their records; ask support for copies of the files.
      documents,
      bankAccounts: without(bankAccounts, "accountNumber", "accountNumberEncrypted", "paystackRecipientCode"),
      payouts,
      commissionLedger,
      // A driver's trips: money and timing only. The rider's addresses and passenger details are theirs, not the driver's.
      trips: without(
        ridesAsDriver,
        "pickupAddress", "dropoffAddress", "pickupLocation", "dropoffLocation",
        "passengerName", "passengerPhone", "sharedWith", "userId"
      ),
      tipsReceived: without(tipsReceived, "riderId"),
      ratingsReceived: ratingsReceived.map((r) => ({ rideId: r.rideId, rating: r.rating, createdAt: r.createdAt })),
      ratingsGivenToRiders: ratingsOfRiders,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    note:
      "This is the information Pantra holds about your account. Other people's personal details are not included. " +
      "Money records (wallet, payments, refunds, fares) are kept for accounting even after an account is deleted.",
    account: {
      profile: without(profile, "pushToken")[0] ?? null,
      preferences: preferences[0] ?? null,
      policyAcceptances,
    },
    savedLocations,
    familyMembers,
    paymentMethods,
    wallet: wallet[0] ?? null,
    walletTransactions,
    points: pointsTransactions,
    promoCodesUsed: promoUses,
    payments: paymentIntents,
    refunds,
    trips: ridesAsRider,
    ratingsGiven,
    tipsGiven,
    ratingsReceivedFromDrivers: ratingsFromDrivers.map((r) => ({ rating: r.rating, createdAt: r.createdAt })),
    supportTickets: tickets.map((t) => ({ ...t, messages: (ticketMessages.data ?? []).filter((m) => m.ticketId === t.id) })),
    conversations: conversations.map((c) => ({ ...c, messages: (chatMessages.data ?? []).filter((m) => m.conversationId === c.id) })),
    driver,
  };
});
