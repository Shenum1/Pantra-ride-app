import type { SupabaseClient } from "@supabase/supabase-js";
import { defineReadTool, defineWriteTool, pick } from "../types";
import {
  completePayoutManually,
  completePayoutManuallyInput,
  failPayoutManually,
  failPayoutManuallyInput,
  listPayouts,
  listPayoutsInput,
  movePayoutToManualReview,
  movePayoutToManualReviewInput,
} from "../../services/admin/payouts";

async function payoutStatusSnapshot(db: SupabaseClient, payoutId: string) {
  const { data, error } = await db.from("driver_payouts").select("status").eq("id", payoutId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Payout not found.");
  return pick(data, ["status"]);
}

export const listPayoutsTool = defineReadTool({
  name: "list_payouts",
  description:
    "List driver payout (withdrawal) requests, newest first, with amount in NGN, status, driver name/email, bank name and last 4 account digits, provider transfer references, and the manual-action audit trail. Pantra currently pays drivers MANUALLY: payouts sit in manual_review until an admin pays them outside Pantra and records it. needsProviderConfirmation=true means a human must check the provider dashboard before completion. Returns {payouts, total}. Read-only.",
  inputSchema: listPayoutsInput,
  run: (db, input) => listPayouts(db, input),
});

export const movePayoutToManualReviewTool = defineWriteTool({
  name: "move_payout_to_manual_review",
  description:
    "Propose pulling a pending or processing payout out of the automatic transfer path into the manual_review queue, where an admin pays it outside Pantra. Records the reason. Never moves money. REQUIRES HUMAN APPROVAL: returns 202 with an actionId; nothing changes until an admin approves.",
  inputSchema: movePayoutToManualReviewInput,
  summarize: (input) => `Move payout ${input.payoutId} to manual review — "${input.reason}"`,
  snapshot: (db, input) => payoutStatusSnapshot(db, input.payoutId),
  run: (db, input, actorAdminId) => movePayoutToManualReview(db, actorAdminId, input),
});

// confirmedNoProviderTransfer is a human attestation ("I checked the provider
// dashboard and no transfer was sent") — the agent can never make it. If the
// provider can't be queried, execution fails and an admin completes the
// payout from the Payouts page instead.
const agentCompletePayoutInput = completePayoutManuallyInput.omit({ confirmedNoProviderTransfer: true });

export const completePayoutManuallyTool = defineWriteTool({
  name: "complete_payout_manually",
  description:
    "Propose recording a manual_review payout as completed, AFTER an admin has already paid the driver outside Pantra. Requires the real bank transfer reference — never invent one; only use a reference a human has given you. Never moves money; it only records the outcome. At approval, Pantra re-checks the payment provider live and refuses if an automatic transfer may already have been sent, to prevent paying a driver twice. REQUIRES HUMAN APPROVAL: returns 202 with an actionId.",
  inputSchema: agentCompletePayoutInput,
  summarize: (input) => `Record payout ${input.payoutId} as paid (transfer ref ${input.externalReference})`,
  snapshot: (db, input) => payoutStatusSnapshot(db, input.payoutId),
  run: (db, input, actorAdminId) => completePayoutManually(db, actorAdminId, input),
});

export const failPayoutManuallyTool = defineWriteTool({
  name: "fail_payout_manually",
  description:
    "Propose marking a manual_review payout as failed because no transfer is possible (e.g. invalid bank details). Releases the reserved balance so the driver can request again with corrected details. Never moves money. REQUIRES HUMAN APPROVAL: returns 202 with an actionId.",
  inputSchema: failPayoutManuallyInput,
  summarize: (input) => `Mark payout ${input.payoutId} as failed — "${input.reason}"`,
  snapshot: (db, input) => payoutStatusSnapshot(db, input.payoutId),
  run: (db, input, actorAdminId) => failPayoutManually(db, actorAdminId, input),
});
