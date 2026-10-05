import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { flutterwaveTransferMayExist, moveToManualReview, reconcileOnePayout } from "../../lib/payout-processor";

export const listPayoutsInput = z.object({
  status: z
    .enum(["pending", "processing", "manual_review", "completed", "failed", "reversed"])
    .optional()
    .describe(
      "Only return payouts in this status. manual_review is the queue of payouts an admin must pay outside Pantra and then record. Omit for all statuses."
    ),
  limit: z.number().int().min(1).max(100).default(50).describe("Maximum number of payouts to return (1-100)."),
  offset: z.number().int().min(0).default(0).describe("Number of payouts to skip, for pagination."),
});

export async function listPayouts(db: SupabaseClient, input: z.infer<typeof listPayoutsInput>) {
  let query = db
    .from("driver_payouts")
    .select(
      "id, driverId, amount, bankAccountId, status, payoutMethod, provider, providerTransferReference, providerTransferCode, failureReason, requestedAt, processingStartedAt, completedAt",
      { count: "exact" }
    )
    .order("requestedAt", { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);

  if (input.status) {
    query = query.eq("status", input.status);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const payoutIds = (data ?? []).map((p) => p.id);
  const driverIds = [...new Set((data ?? []).map((p) => p.driverId).filter(Boolean))];
  const bankAccountIds = [...new Set((data ?? []).map((p) => p.bankAccountId).filter(Boolean))];

  const [driversRes, bankRes, manualActionsRes, reconciliationRes, attemptsRes] = await Promise.all([
    driverIds.length > 0
      ? db.from("drivers").select("id, name, email").in("id", driverIds)
      : Promise.resolve({ data: [] as { id: string; name: string; email: string }[] }),
    bankAccountIds.length > 0
      ? db.from("driver_bank_accounts").select("id, bankName, accountNumberLast4, accountName").in("id", bankAccountIds)
      : Promise.resolve({ data: [] as { id: string; bankName: string; accountNumberLast4: string; accountName: string }[] }),
    payoutIds.length > 0
      ? db
          .from("payout_manual_actions")
          .select("id, payoutId, adminUserId, action, externalReference, notes, createdAt")
          .in("payoutId", payoutIds)
          .order("createdAt", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    payoutIds.length > 0
      ? db.from("payment_reconciliation_records").select("payoutId").in("payoutId", payoutIds).eq("reconciliationStatus", "open")
      : Promise.resolve({ data: [] as { payoutId: string }[] }),
    payoutIds.length > 0
      ? db.from("payout_provider_attempts").select("payoutId, attemptStatus").in("payoutId", payoutIds)
      : Promise.resolve({ data: [] as { payoutId: string; attemptStatus: string }[] }),
  ]);

  const driverMap = new Map((driversRes.data ?? []).map((d) => [d.id, { name: d.name, email: d.email }]));
  const bankMap = new Map(
    (bankRes.data ?? []).map((b) => [b.id, { bankName: b.bankName, accountNumberLast4: b.accountNumberLast4, accountName: b.accountName }])
  );
  const manualActionsByPayout = new Map<string, any[]>();
  for (const action of manualActionsRes.data ?? []) {
    const list = manualActionsByPayout.get(action.payoutId) ?? [];
    list.push(action);
    manualActionsByPayout.set(action.payoutId, list);
  }
  const openReconciliationPayoutIds = new Set((reconciliationRes.data ?? []).map((r) => r.payoutId));
  const attemptStatusesByPayout = new Map<string, string[]>();
  for (const attempt of attemptsRes.data ?? []) {
    const list = attemptStatusesByPayout.get(attempt.payoutId) ?? [];
    list.push(attempt.attemptStatus);
    attemptStatusesByPayout.set(attempt.payoutId, list);
  }

  const payouts = (data ?? []).map((p) => ({
    ...p,
    driver: driverMap.get(p.driverId) ?? null,
    bankAccount: p.bankAccountId ? (bankMap.get(p.bankAccountId) ?? null) : null,
    manualActions: manualActionsByPayout.get(p.id) ?? [],
    hasOpenReconciliation: openReconciliationPayoutIds.has(p.id),
    // Same rule completePayoutManually enforces: a Flutterwave transfer may
    // exist but can't be looked up, so manual completion needs the admin to
    // confirm against the dashboard first.
    needsProviderConfirmation:
      p.provider === "flutterwave" && !p.providerTransferCode && flutterwaveTransferMayExist(attemptStatusesByPayout.get(p.id) ?? []),
  }));

  return { payouts, total: count ?? 0 };
}

export const movePayoutToManualReviewInput = z.object({
  payoutId: z.string().uuid().describe("UUID of the payout, which must currently be pending or processing."),
  reason: z.string().min(1).describe("Why this payout is being pulled out of the automatic path; recorded in the audit trail."),
});

// Lets an admin explicitly pull a payout out of the automatic path — the only
// other way a payout reaches manual_review is the automatic path failing.
export async function movePayoutToManualReview(
  db: SupabaseClient,
  actorAdminId: string,
  input: z.infer<typeof movePayoutToManualReviewInput>
) {
  const { data: payout, error } = await db.from("driver_payouts").select("id, status").eq("id", input.payoutId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!payout) throw new Error("Payout not found.");
  if (payout.status !== "pending" && payout.status !== "processing") {
    throw new Error(`Payout is already ${payout.status} and cannot be moved to manual review.`);
  }

  await moveToManualReview(db, input.payoutId, input.reason, actorAdminId);
  return { success: true };
}

export const completePayoutManuallyInput = z.object({
  payoutId: z.string().uuid().describe("UUID of the payout, which must currently be in manual_review."),
  externalReference: z
    .string()
    .min(1)
    .describe("Reference of the real bank transfer an admin already made outside Pantra (e.g. the bank's transaction reference)."),
  notes: z.string().optional().describe("Optional free-text notes recorded in the payout's audit trail."),
  // Required only when the provider can't be asked whether an automatic
  // transfer went out (see reconcileOnePayout's `unverifiable`): the admin
  // attests they searched the provider's dashboard for this payout's
  // reference and found no transfer. Recorded in the audit row.
  confirmedNoProviderTransfer: z.boolean().optional(),
});

// The ONLY way a payout can be marked completed by an admin. Requires the
// payout to already be in manual_review, an external transfer reference, and
// — critically — a live re-check against the payout's provider right before
// completing, so a payout whose automatic transfer actually already succeeded
// can never be completed manually (the double-payment case). Every completion
// is recorded in payout_manual_actions with the admin's own id.
export async function completePayoutManually(
  db: SupabaseClient,
  actorAdminId: string,
  input: z.infer<typeof completePayoutManuallyInput>
) {
  const { data: payout, error } = await db
    .from("driver_payouts")
    .select("id, status, provider, providerTransferReference")
    .eq("id", input.payoutId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!payout) throw new Error("Payout not found.");

  if (payout.status === "completed") {
    throw new Error("This payout is already completed.");
  }
  if (payout.status !== "manual_review") {
    throw new Error(
      `Payout must be in manual_review before it can be completed manually (currently ${payout.status}). Use admin.payouts.moveToManualReview first.`
    );
  }

  // If an automatic transfer was ever attempted, verify with its provider
  // RIGHT NOW that it didn't actually succeed — never trust stale local state
  // for this check. reconcileOnePayout itself applies 'completed' if the
  // provider confirms success, in which case this manual completion is then
  // correctly refused because the payout is no longer manual_review.
  let providerConfirmationNote: string | null = null;
  if ((payout.provider === "paystack" || payout.provider === "flutterwave") && payout.providerTransferReference) {
    const check = await reconcileOnePayout(db, input.payoutId);

    const { data: recheck, error: recheckError } = await db.from("driver_payouts").select("status").eq("id", input.payoutId).single();
    if (recheckError) throw new Error(recheckError.message);

    if (recheck.status !== "manual_review") {
      throw new Error(
        `Refused: the provider re-check moved this payout to '${recheck.status}' — an automatic transfer may already have succeeded. Manual completion was NOT applied.`
      );
    }

    // The provider couldn't be asked, and a transfer may exist. Paying
    // manually now risks paying the driver twice — only a human who has
    // checked the provider's dashboard can rule that out.
    if (check.unverifiable) {
      if (!input.confirmedNoProviderTransfer) {
        throw new Error(
          `Refused: an automatic ${payout.provider} transfer may already have been sent for this payout and Pantra can't look it up. Search the ${payout.provider} dashboard for reference ${payout.providerTransferReference}, and only complete manually after confirming no transfer was sent. Manual completion was NOT applied.`
        );
      }
      providerConfirmationNote = `Admin confirmed in the ${payout.provider} dashboard that no transfer was sent for reference ${payout.providerTransferReference}.`;
    }
  }

  const { error: updateError } = await db.from("driver_payouts").update({ status: "completed" }).eq("id", input.payoutId);
  if (updateError) throw new Error(updateError.message);

  await db.from("payout_manual_actions").insert({
    payoutId: input.payoutId,
    adminUserId: actorAdminId,
    action: "manual_completed",
    externalReference: input.externalReference,
    notes: [providerConfirmationNote, input.notes].filter(Boolean).join(" ") || null,
  });

  return { success: true };
}

export const failPayoutManuallyInput = z.object({
  payoutId: z.string().uuid().describe("UUID of the payout, which must currently be in manual_review."),
  reason: z
    .string()
    .min(1)
    .describe("Why no transfer is possible (e.g. invalid bank details). Releases the reserved balance so the driver can request again."),
});

// Marks a payout in manual_review as failed. Releases the reservation —
// get_driver_available_balance excludes 'failed' — so the driver can request
// again with corrected details.
export async function failPayoutManually(db: SupabaseClient, actorAdminId: string, input: z.infer<typeof failPayoutManuallyInput>) {
  const { data: payout, error } = await db.from("driver_payouts").select("id, status").eq("id", input.payoutId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!payout) throw new Error("Payout not found.");
  if (payout.status !== "manual_review") {
    throw new Error(`Payout must be in manual_review to be failed manually (currently ${payout.status}).`);
  }

  const { error: updateError } = await db
    .from("driver_payouts")
    .update({ status: "failed", failureReason: input.reason })
    .eq("id", input.payoutId);
  if (updateError) throw new Error(updateError.message);

  await db.from("payout_manual_actions").insert({
    payoutId: input.payoutId,
    adminUserId: actorAdminId,
    action: "manual_failed",
    notes: input.reason,
  });

  return { success: true };
}
