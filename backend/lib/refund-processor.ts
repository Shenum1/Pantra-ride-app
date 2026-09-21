// The ONE place that executes a refund and the ONE place that applies a
// provider refund outcome (webhook or reconciliation check) to a
// refund_intents row. Mirrors payout-processor.ts's role for Phase 3A.
//
// Two distinct execution paths, chosen by originalPaymentType:
//  - 'ride_wallet_payment': pure wallet-to-wallet credit via the existing
//    add_wallet_transaction RPC (type='refund', already a pre-built credit
//    type with its own reference-based unique-index idempotency — nothing
//    new invented here). Synchronous and final; no provider involved.
//  - 'wallet_topup': debits the wallet (reversing the original top-up
//    credit) THEN calls the original provider's refund API. Two-sided by
//    necessity: the money already left the provider and is sitting in the
//    wallet, so "refunding a top-up" has to touch both.

import { SupabaseClient } from "@supabase/supabase-js";
import {
  createFlutterwaveRefund,
  createPaystackRefund,
  fetchFlutterwaveRefundById,
  fetchFlutterwaveRefundsForTransaction,
  fetchPaystackRefundsForTransaction,
  generateRefundReference,
  isFlutterwaveRefundWebhookShape,
  parseFlutterwaveRefundWebhookPayload,
  ProviderRefundRecord,
  RefundProviderState,
} from "./refund-provider";

export { generateRefundReference, isFlutterwaveRefundWebhookShape };

// Server-only, read at call time (not a module-level constant) so it's easy
// to override per-environment without a code change. Used to build the
// callbackurl passed to Flutterwave on refund creation — see
// executeWalletTopupRefund. Falls back to the app's own existing base-URL
// var (already read server-side elsewhere, e.g. the /google-maps proxy)
// since no refund-specific one exists yet.
function getApiBaseUrl(): string | null {
  return process.env.PANTRA_API_BASE_URL || process.env.EXPO_PUBLIC_RORK_API_BASE_URL || null;
}

interface RefundRow {
  id: string;
  originalPaymentType: "wallet_topup" | "ride_wallet_payment";
  paymentIntentId: string | null;
  rideId: string | null;
  userId: string;
  amount: number;
  reason: string | null;
  status: string;
  refundReference: string;
  providerRefundId: string | null;
  providerRefundReference: string | null;
}

async function loadRefund(supabaseAdmin: SupabaseClient, refundId: string): Promise<RefundRow | null> {
  const { data, error } = await supabaseAdmin
    .from("refund_intents")
    .select("id, originalPaymentType, paymentIntentId, rideId, userId, amount, reason, status, refundReference, providerRefundId, providerRefundReference")
    .eq("id", refundId)
    .maybeSingle<RefundRow>();
  if (error) throw new Error(`Failed to load refund: ${error.message}`);
  return data;
}

async function loadRefundByProviderRefundId(supabaseAdmin: SupabaseClient, providerRefundId: string): Promise<RefundRow | null> {
  const { data, error } = await supabaseAdmin
    .from("refund_intents")
    .select("id, originalPaymentType, paymentIntentId, rideId, userId, amount, reason, status, refundReference, providerRefundId, providerRefundReference")
    .eq("providerRefundId", providerRefundId)
    .maybeSingle<RefundRow>();
  if (error) throw new Error(`Failed to look up refund by provider refund id: ${error.message}`);
  return data;
}

async function setRefundStatus(
  supabaseAdmin: SupabaseClient,
  refundId: string,
  status: string,
  extra?: { failureReason?: string | null }
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("refund_intents")
    .update({ status, ...(extra?.failureReason !== undefined ? { failureReason: extra.failureReason } : {}) })
    .eq("id", refundId);
  if (error) throw new Error(`Failed to update refund status: ${error.message}`);
}

async function markAttempt(
  supabaseAdmin: SupabaseClient,
  refundId: string,
  attemptStatus: string,
  extra?: { failureReason?: string | null; httpStatus?: number | null }
): Promise<void> {
  await supabaseAdmin
    .from("refund_provider_attempts")
    .update({
      attemptStatus,
      failureReason: extra?.failureReason ?? null,
      httpStatus: extra?.httpStatus ?? null,
      updatedAt: new Date().toISOString(),
    })
    .eq("refundId", refundId)
    .eq("attemptStatus", "call_initiated");
}

async function recordRefundEvent(
  supabaseAdmin: SupabaseClient,
  fields: {
    refundId: string | null;
    provider: string;
    refundReference?: string | null;
    providerEventId?: string;
    eventType: string;
    providerState?: RefundProviderState | null;
    amount?: number | null;
    currency?: string | null;
    processingStatus: string;
    failureReason?: string | null;
  }
): Promise<boolean> {
  const { error } = await supabaseAdmin.from("refund_events").insert({
    refundId: fields.refundId,
    provider: fields.provider,
    refundReference: fields.refundReference ?? null,
    providerEventId: fields.providerEventId ?? null,
    eventType: fields.eventType,
    providerState: fields.providerState ?? null,
    amount: fields.amount ?? null,
    currency: fields.currency ?? null,
    processingStatus: fields.processingStatus,
    failureReason: fields.failureReason ?? null,
    processedAt: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "23505") return false;
    throw new Error(`Failed to record refund event: ${error.message}`);
  }
  return true;
}

async function recordRefundReconciliation(
  supabaseAdmin: SupabaseClient,
  fields: {
    refundId: string | null;
    provider: string;
    reference: string;
    expectedAmount: number | null;
    providerAmount: number | null;
    currency: string | null;
    pantraStatus: string | null;
    providerStatus: string | null;
    mismatchType: string;
  }
): Promise<void> {
  const { error } = await supabaseAdmin.from("payment_reconciliation_records").insert({
    paymentIntentId: null,
    payoutId: null,
    refundId: fields.refundId,
    provider: fields.provider,
    reference: fields.reference,
    expectedAmount: fields.expectedAmount,
    providerAmount: fields.providerAmount,
    currency: fields.currency,
    pantraStatus: fields.pantraStatus,
    providerStatus: fields.providerStatus,
    mismatchType: fields.mismatchType,
  });
  if (error) throw new Error(`Failed to record refund reconciliation record: ${error.message}`);
}

// Compensates a wallet debit that was made in anticipation of a provider
// refund which then turned out NOT to have happened (rejected, or
// provider-confirmed failure/reversal) — otherwise Pantra would have taken
// money out of the rider's wallet for a refund that never actually landed.
// A single, controlled, non-retried code path (never exposed to client
// retry), so it is intentionally not covered by a DB uniqueness guard the
// way add_money/refund credits are — documented, not overlooked.
async function reverseWalletDebit(supabaseAdmin: SupabaseClient, refund: RefundRow, reason: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc("add_wallet_transaction", {
    p_user_id: refund.userId,
    p_type: "credit",
    p_amount: refund.amount,
    p_description: `Refund reversal: ${reason}`,
    p_status: "completed",
    p_ride_id: null,
    p_payment_method_id: null,
    p_reference: `${refund.refundReference}-REVERSAL`,
    p_metadata: { refundIntentId: refund.id, reversalOf: refund.refundReference },
  });
  if (error) {
    console.error(
      `refund ${refund.id}: FAILED to reverse wallet debit after "${reason}" — the rider's wallet may be short by ${refund.amount}. Manual intervention required: ${error.message}`
    );
  }
}

async function computeAndAttachDriverImpact(supabaseAdmin: SupabaseClient, refund: RefundRow): Promise<void> {
  if (!refund.rideId) return;
  const { data: ride } = await supabaseAdmin
    .from("rides")
    .select("fare, driverEarningsAmount")
    .eq("id", refund.rideId)
    .maybeSingle();
  if (!ride || !ride.fare || ride.fare <= 0 || !ride.driverEarningsAmount) return;

  // Informational only — Pantra's payout model pays from an aggregate
  // available balance, not per-ride escrow, so whether THIS ride's earnings
  // were already withdrawn can't be determined automatically. This number
  // is surfaced to an admin, never auto-applied as a wallet/payout
  // mutation. See the implementation report's "business policy decisions
  // required" section.
  const proportional = Math.round((refund.amount * (ride.driverEarningsAmount / ride.fare)) * 100) / 100;
  if (proportional > 0) {
    await supabaseAdmin
      .from("refund_intents")
      .update({ driverImpactAmount: proportional, requiresDriverAdjustmentReview: true })
      .eq("id", refund.id);
  }
}

async function executeWalletCreditRefund(supabaseAdmin: SupabaseClient, refund: RefundRow): Promise<void> {
  await setRefundStatus(supabaseAdmin, refund.id, "processing");

  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("add_wallet_transaction", {
    p_user_id: refund.userId,
    p_type: "refund",
    p_amount: refund.amount,
    p_description: refund.reason ? `Refund: ${refund.reason}` : "Ride payment refund",
    p_status: "completed",
    p_ride_id: refund.rideId,
    p_payment_method_id: null,
    p_reference: refund.refundReference,
    p_metadata: { refundIntentId: refund.id },
  });

  if (rpcError) {
    await setRefundStatus(supabaseAdmin, refund.id, "failed", { failureReason: rpcError.message });
    return;
  }

  const txn = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  await computeAndAttachDriverImpact(supabaseAdmin, refund);
  await supabaseAdmin.from("refund_intents").update({ walletTransactionId: txn?.id ?? null }).eq("id", refund.id);
  await setRefundStatus(supabaseAdmin, refund.id, "completed");
}

async function executeWalletTopupRefund(supabaseAdmin: SupabaseClient, refund: RefundRow): Promise<void> {
  const { data: intent, error: intentError } = await supabaseAdmin
    .from("payment_intents")
    .select("id, provider, reference, providerTransactionId, currency, status")
    .eq("id", refund.paymentIntentId)
    .maybeSingle();

  if (intentError || !intent || intent.status !== "successful") {
    await setRefundStatus(supabaseAdmin, refund.id, "failed", { failureReason: "Original payment is no longer in a refundable state." });
    return;
  }

  await setRefundStatus(supabaseAdmin, refund.id, "processing");

  // Claim before ANY money movement — neither provider's refund-creation
  // endpoint accepts an idempotency reference (unlike Transfers), so this DB
  // guard is the PRIMARY protection against a concurrent duplicate
  // invocation debiting the wallet twice, not a secondary one.
  const { error: claimError } = await supabaseAdmin.from("refund_provider_attempts").insert({
    refundId: refund.id,
    provider: intent.provider,
    refundReference: refund.refundReference,
    attemptStatus: "call_initiated",
  });
  if (claimError) {
    if (claimError.code === "23505") return; // another attempt already in flight
    throw new Error(`Failed to record refund provider attempt: ${claimError.message}`);
  }

  const { error: debitError } = await supabaseAdmin.rpc("add_wallet_transaction", {
    p_user_id: refund.userId,
    p_type: "debit",
    p_amount: -refund.amount,
    p_description: refund.reason ? `Refund: ${refund.reason}` : "Wallet top-up refund",
    p_status: "completed",
    p_ride_id: null,
    p_payment_method_id: null,
    p_reference: refund.refundReference,
    p_metadata: { refundIntentId: refund.id },
  });

  if (debitError) {
    const insufficientBalance = (debitError.message ?? "").toLowerCase().includes("insufficient balance");
    await markAttempt(supabaseAdmin, refund.id, "call_rejected", { failureReason: debitError.message });
    await setRefundStatus(supabaseAdmin, refund.id, "failed", {
      failureReason: insufficientBalance
        ? "Wallet balance is insufficient to reverse this top-up — the rider has already spent some or all of it."
        : debitError.message,
    });
    return;
  }

  // callbackurl: a PER-REQUEST parameter, needs no account-level opt-in —
  // unlike Flutterwave's general refund webhook, which is OFF by default
  // until Flutterwave support enables it for the merchant account (verified
  // live from their own docs). This is why it's used as the primary
  // asynchronous notification path for Flutterwave refunds specifically.
  const apiBaseUrl = getApiBaseUrl();
  const flutterwaveCallbackUrl = apiBaseUrl ? `${apiBaseUrl.replace(/\/$/, "")}/api/webhooks/flutterwave-refund-callback` : undefined;

  const providerResult =
    intent.provider === "paystack"
      ? await createPaystackRefund({ transactionReference: intent.reference, amount: refund.amount })
      : intent.providerTransactionId
        ? await createFlutterwaveRefund({ transactionId: intent.providerTransactionId, amount: refund.amount, callbackUrl: flutterwaveCallbackUrl })
        : {
            ok: false as const,
            outcome: "rejected" as const,
            refund: null,
            httpStatus: null,
            message: "Missing the provider's own transaction id on the original payment — cannot create a Flutterwave refund automatically.",
          };

  await markAttempt(
    supabaseAdmin,
    refund.id,
    providerResult.ok ? "call_succeeded" : providerResult.outcome === "network_error" ? "call_timeout" : "call_rejected",
    { failureReason: providerResult.ok ? null : providerResult.message, httpStatus: providerResult.httpStatus }
  );

  if (providerResult.ok && providerResult.refund) {
    // Identity validation (§5 of the hardening pass): a Flutterwave refund
    // response's own transactionId must match the ORIGINAL transaction this
    // refund was actually requested against. A mismatch here would mean
    // Flutterwave's response doesn't correspond to what we asked for at
    // all — treated as a hard stop, never silently accepted.
    if (
      intent.provider === "flutterwave" &&
      providerResult.refund.transactionId &&
      providerResult.refund.transactionId !== String(intent.providerTransactionId)
    ) {
      await recordRefundReconciliation(supabaseAdmin, {
        refundId: refund.id,
        provider: intent.provider,
        reference: refund.refundReference,
        expectedAmount: refund.amount,
        providerAmount: providerResult.refund.amount,
        currency: intent.currency,
        pantraStatus: refund.status,
        providerStatus: "unknown",
        mismatchType: "refund_unmatched_provider_transaction",
      });
      await setRefundStatus(supabaseAdmin, refund.id, "unknown", {
        failureReason: `Provider refund response references transaction ${providerResult.refund.transactionId}, expected ${intent.providerTransactionId}.`,
      });
      return;
    }

    await supabaseAdmin
      .from("refund_intents")
      .update({
        providerRefundId: providerResult.refund.providerRefundId,
        providerRefundReference: providerResult.refund.flwRef ?? null,
      })
      .eq("id", refund.id);

    // Never mark completed from the creation response alone — the same rule
    // as Phase 3A transfers, and doubly true here: Flutterwave's own
    // 'completed' status on the CREATE response means "pending
    // disbursement," not success. Only the callback, webhook, or an
    // explicit reconciliation check ever moves this to 'completed'.
    await recordRefundEvent(supabaseAdmin, {
      refundId: refund.id,
      provider: intent.provider,
      refundReference: refund.refundReference,
      eventType: "refund_initiated",
      providerState: providerResult.refund.providerState,
      amount: refund.amount,
      currency: intent.currency,
      processingStatus: "received",
    });
    return;
  }

  if (providerResult.outcome === "network_error") {
    // Wallet already debited; genuinely unknown whether the provider
    // received the request. Ask directly rather than assuming.
    await reconcileOneRefund(supabaseAdmin, refund.id);
    return;
  }

  // A clear provider rejection: the wallet was already debited, so leaving
  // the rider short with no refund in flight would itself be a bug —
  // reverse the debit rather than strand the rider's money.
  await reverseWalletDebit(supabaseAdmin, refund, "Provider rejected the refund request.");
  await setRefundStatus(supabaseAdmin, refund.id, "failed", { failureReason: providerResult.message });
}

// The automatic entry point — called once, synchronously, right after a new
// refund_intents row is inserted (backend/trpc/routes/admin/refunds/request).
export async function initiateRefund(supabaseAdmin: SupabaseClient, refundId: string): Promise<void> {
  const refund = await loadRefund(supabaseAdmin, refundId);
  if (!refund) return;
  if (refund.status !== "requested") return;

  if (refund.originalPaymentType === "ride_wallet_payment") {
    await executeWalletCreditRefund(supabaseAdmin, refund);
  } else {
    await executeWalletTopupRefund(supabaseAdmin, refund);
  }
}

// Identity-first provider lookup — the core of the §7 hardening pass.
//
// Paystack: unchanged from before (no per-refund GET-by-id endpoint is
// exposed the same way; matches by provider refund id once known, else by
// amount against the transaction's refund list — documented as a known
// limitation, Paystack's refund-creation endpoint has no reference param
// either).
//
// Flutterwave: genuinely identity-first now that GET /v3/refunds/{id} is
// confirmed to exist. If refund.providerRefundId is already known (the
// normal case), this looks it up DIRECTLY — no amount matching enters into
// it at all. Amount matching is only ever reached in the true "we never
// even received the create-call's response" case, and even then only as a
// last resort after checking for a single unambiguous transaction match or
// an already-known flw_ref — multiple same-amount candidates are left
// unresolved rather than guessed at.
async function resolveProviderRefund(
  provider: "paystack" | "flutterwave",
  originalReference: string,
  providerTransactionId: string | null,
  refund: RefundRow
): Promise<ProviderRefundRecord | null> {
  if (provider === "paystack") {
    const matches = await fetchPaystackRefundsForTransaction(originalReference);
    return refund.providerRefundId
      ? (matches.find((m) => m.providerRefundId === refund.providerRefundId) ?? null)
      : (matches.find((m) => m.amount === refund.amount) ?? null);
  }

  if (refund.providerRefundId) {
    return fetchFlutterwaveRefundById(refund.providerRefundId);
  }

  if (!providerTransactionId) return null;
  const matches = await fetchFlutterwaveRefundsForTransaction(providerTransactionId);

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]; // unambiguous — only one refund exists for this transaction at all

  if (refund.providerRefundReference) {
    const byRef = matches.find((m) => m.flwRef === refund.providerRefundReference);
    if (byRef) return byRef;
  }
  const byAmount = matches.filter((m) => m.amount === refund.amount);
  if (byAmount.length === 1) return byAmount[0]; // still unambiguous after narrowing by amount

  // Genuinely ambiguous (multiple refunds, same amount, no known flw_ref to
  // disambiguate) — never guess. The caller records this as unresolved.
  return null;
}

// Asks the provider directly what it knows about a wallet-top-up refund and
// applies ONLY safe, already-happened outcomes — never a new refund
// request. Shared by the timeout-recovery path inside
// executeWalletTopupRefund, admin.refunds.reconciliation.run (sweep), and
// .checkOne (spot check).
export async function reconcileOneRefund(supabaseAdmin: SupabaseClient, refundId: string): Promise<{ status: boolean; message: string }> {
  const refund = await loadRefund(supabaseAdmin, refundId);
  if (!refund) return { status: false, message: "Refund not found." };
  if (refund.originalPaymentType !== "wallet_topup") {
    return { status: false, message: "Reconciliation only applies to provider-backed refunds." };
  }
  if (refund.status === "reversed" || refund.status === "completed") {
    return { status: true, message: `Refund already ${refund.status} — nothing to reconcile.` };
  }

  const { data: intent } = await supabaseAdmin
    .from("payment_intents")
    .select("provider, reference, providerTransactionId, currency")
    .eq("id", refund.paymentIntentId)
    .maybeSingle();
  if (!intent) return { status: false, message: "Original payment intent not found." };

  const found = await resolveProviderRefund(intent.provider, intent.reference, intent.providerTransactionId, refund);

  if (!found) {
    if (refund.status !== "failed") {
      await setRefundStatus(supabaseAdmin, refund.id, "unknown", { failureReason: "Provider has no matching refund on record yet." });
    }
    await recordRefundReconciliation(supabaseAdmin, {
      refundId: refund.id,
      provider: intent.provider,
      reference: refund.refundReference,
      expectedAmount: refund.amount,
      providerAmount: null,
      currency: intent.currency,
      pantraStatus: refund.status,
      providerStatus: "unknown",
      mismatchType: "refund_unmatched_provider_transaction",
    });
    return { status: false, message: "Provider has no matching refund record (yet)." };
  }

  await supabaseAdmin
    .from("refund_intents")
    .update({ providerRefundId: found.providerRefundId, providerRefundReference: found.flwRef ?? refund.providerRefundReference })
    .eq("id", refund.id);

  if (found.amount != null && found.amount !== refund.amount) {
    await setRefundStatus(supabaseAdmin, refund.id, "unknown", {
      failureReason: `Provider refund amount (${found.amount}) does not match the requested amount (${refund.amount}).`,
    });
    await recordRefundReconciliation(supabaseAdmin, {
      refundId: refund.id,
      provider: intent.provider,
      reference: refund.refundReference,
      expectedAmount: refund.amount,
      providerAmount: found.amount,
      currency: intent.currency,
      pantraStatus: refund.status,
      providerStatus: found.providerState,
      mismatchType: "refund_amount_mismatch",
    });
    return { status: false, message: "Amount mismatch detected — requires manual review." };
  }

  // Currency, where the provider actually returns one — Flutterwave's
  // refund object (create response, GET /v3/refunds/{id}, and especially
  // the flat webhook payload) does not reliably carry a currency field, so
  // this only fires when `found.currency` is actually present, per the
  // spec's own "currency where available."
  if (found.currency && intent.currency && found.currency !== intent.currency) {
    await setRefundStatus(supabaseAdmin, refund.id, "unknown", {
      failureReason: `Provider refund currency (${found.currency}) does not match the original payment's currency (${intent.currency}).`,
    });
    await recordRefundReconciliation(supabaseAdmin, {
      refundId: refund.id,
      provider: intent.provider,
      reference: refund.refundReference,
      expectedAmount: refund.amount,
      providerAmount: found.amount,
      currency: found.currency,
      pantraStatus: refund.status,
      providerStatus: found.providerState,
      mismatchType: "refund_currency_mismatch",
    });
    return { status: false, message: "Currency mismatch detected — requires manual review." };
  }

  if (found.providerState === "successful") {
    try {
      await setRefundStatus(supabaseAdmin, refund.id, "completed");
      await recordRefundEvent(supabaseAdmin, {
        refundId: refund.id,
        provider: intent.provider,
        refundReference: refund.refundReference,
        eventType: "reconciliation_check",
        providerState: found.providerState,
        amount: found.amount,
        currency: intent.currency,
        processingStatus: "processed",
      });
    } catch (e) {
      console.error(`refund ${refund.id}: reconciliation could not apply completed transition: ${(e as Error).message}`);
      return { status: false, message: "Provider confirms success but the local transition was rejected — requires manual review." };
    }
    return { status: true, message: "Provider confirms this refund succeeded." };
  }

  if (found.providerState === "failed") {
    if (refund.status === "processing" || refund.status === "unknown") {
      await reverseWalletDebit(supabaseAdmin, refund, "Provider confirmed the refund failed.");
      await setRefundStatus(supabaseAdmin, refund.id, "failed", { failureReason: "Provider confirmed the refund failed." });
    }
    return { status: false, message: "Provider confirms this refund failed." };
  }

  if (refund.status !== "unknown") {
    await setRefundStatus(supabaseAdmin, refund.id, "unknown");
  }
  return { status: false, message: "Provider has not yet confirmed a final outcome for this refund." };
}

function mapPaystackEventToState(eventType: string): RefundProviderState {
  if (eventType === "refund.processed") return "successful";
  if (eventType === "refund.failed") return "failed";
  if (eventType === "refund.pending") return "pending";
  return "unknown";
}

export interface RefundWebhookPayload {
  event?: string;
  data?: any;
}

// Paystack refund webhook — event-wrapped ({event, data}), the same shape as
// charge.*/transfer.* (already verified against Paystack's docs in earlier
// hardening passes). §9's "notification -> provider verification -> Pantra
// transition" rule is implemented by NEVER applying 'successful'/'failed'
// directly from the payload: any terminal-looking signal triggers
// reconcileOneRefund, which independently re-verifies with Paystack before
// touching refund_intents at all. The webhook is a trigger to go check, not
// permission to move money.
async function processPaystackRefundWebhookEvent(supabaseAdmin: SupabaseClient, payload: RefundWebhookPayload): Promise<void> {
  const eventType = payload?.event ?? "unknown";
  const providerRefundId = payload?.data?.id != null ? String(payload.data.id) : undefined;

  if (!providerRefundId) {
    console.error("Paystack refund webhook received with no provider refund id — ignoring.", { eventType });
    return;
  }

  const refund = await loadRefundByProviderRefundId(supabaseAdmin, providerRefundId);

  if (!refund) {
    await recordRefundEvent(supabaseAdmin, {
      refundId: null,
      provider: "paystack",
      providerEventId: providerRefundId,
      eventType,
      processingStatus: "rejected_unmatched_refund",
      failureReason: "No refund_intents row linked to this provider refund id (yet).",
    });
    return;
  }

  if (refund.status === "completed" || refund.status === "failed" || refund.status === "reversed") {
    await recordRefundEvent(supabaseAdmin, {
      refundId: refund.id,
      provider: "paystack",
      providerEventId: providerRefundId,
      eventType,
      processingStatus: "ignored_duplicate",
    });
    return;
  }

  const providerState = mapPaystackEventToState(eventType);
  const amount = payload?.data?.amount != null ? Number(payload.data.amount) / 100 : null;
  const currency = payload?.data?.currency ?? "NGN";

  const recordedFresh = await recordRefundEvent(supabaseAdmin, {
    refundId: refund.id,
    provider: "paystack",
    refundReference: refund.refundReference,
    providerEventId: providerRefundId,
    eventType,
    providerState,
    amount,
    currency,
    processingStatus: "received",
  });
  if (!recordedFresh) return; // duplicate delivery of an event already fully recorded

  if (providerState === "successful" || providerState === "failed") {
    await reconcileOneRefund(supabaseAdmin, refund.id);
  }
  // pending/unknown — already durably recorded above, no transition yet.
}

// Flutterwave refund webhook AND callbackurl notification — shared handling,
// per §10's "all callback/webhook paths must converge into the same refund
// processor." Both are treated with EQUAL suspicion: the callback's
// signing is not documented/confirmed at all, and the account-wide webhook
// requires Flutterwave to have separately enabled it for the merchant
// (confirmed live from Flutterwave's own refunds doc — off by default).
// Neither payload's own "status" is ever applied directly; both trigger a
// live reconcileOneRefund call, which re-verifies via
// GET /v3/refunds/{id} before touching refund_intents.
async function processFlutterwaveRefundNotification(
  supabaseAdmin: SupabaseClient,
  payload: any,
  source: "webhook" | "callback"
): Promise<void> {
  if (!isFlutterwaveRefundWebhookShape(payload)) {
    console.error(`Flutterwave refund ${source} received with an unrecognized payload shape — ignoring.`);
    return;
  }

  const notification = parseFlutterwaveRefundWebhookPayload(payload);
  const providerRefundId = notification.providerRefundId;

  if (!providerRefundId) {
    console.error(`Flutterwave refund ${source} received with no refund id — ignoring.`);
    return;
  }

  const refund = await loadRefundByProviderRefundId(supabaseAdmin, providerRefundId);

  if (!refund) {
    // Genuinely possible for the webhook/callback to race ahead of our own
    // create-call's response linking providerRefundId locally — a
    // reconciliation sweep (matching by original transaction) will pick
    // this up rather than this notification being silently dropped forever.
    await recordRefundEvent(supabaseAdmin, {
      refundId: null,
      provider: "flutterwave",
      providerEventId: providerRefundId,
      eventType: `refund.${source}`,
      processingStatus: "rejected_unmatched_refund",
      failureReason: `No refund_intents row linked to this provider refund id (yet), via ${source}.`,
    });
    return;
  }

  if (refund.status === "completed" || refund.status === "failed" || refund.status === "reversed") {
    await recordRefundEvent(supabaseAdmin, {
      refundId: refund.id,
      provider: "flutterwave",
      providerEventId: providerRefundId,
      eventType: `refund.${source}`,
      processingStatus: "ignored_duplicate",
    });
    return;
  }

  // Identity validation: the notification's own transactionId (when
  // present) must match the ORIGINAL transaction this refund was actually
  // requested against — never proceed on a refund id match alone if the
  // linked transaction disagrees.
  if (notification.transactionId && refund.paymentIntentId) {
    const { data: intent } = await supabaseAdmin
      .from("payment_intents")
      .select("providerTransactionId")
      .eq("id", refund.paymentIntentId)
      .maybeSingle();
    if (intent?.providerTransactionId && String(intent.providerTransactionId) !== notification.transactionId) {
      await recordRefundEvent(supabaseAdmin, {
        refundId: refund.id,
        provider: "flutterwave",
        providerEventId: providerRefundId,
        eventType: `refund.${source}`,
        processingStatus: "rejected_unmatched_refund",
        failureReason: `Notification transactionId ${notification.transactionId} does not match the original payment's ${intent.providerTransactionId}.`,
      });
      await recordRefundReconciliation(supabaseAdmin, {
        refundId: refund.id,
        provider: "flutterwave",
        reference: refund.refundReference,
        expectedAmount: refund.amount,
        providerAmount: notification.amount,
        currency: null,
        pantraStatus: refund.status,
        providerStatus: "unknown",
        mismatchType: "refund_unmatched_provider_transaction",
      });
      return;
    }
  }

  const recordedFresh = await recordRefundEvent(supabaseAdmin, {
    refundId: refund.id,
    provider: "flutterwave",
    refundReference: refund.refundReference,
    providerEventId: providerRefundId,
    eventType: `refund.${source}`,
    providerState: notification.providerState,
    amount: notification.amount,
    currency: notification.currency,
    processingStatus: "received",
  });
  if (!recordedFresh) return; // duplicate delivery of a notification already fully recorded

  // Never apply notification.providerState directly — always re-verify
  // server-to-server first (reconcileOneRefund calls GET /v3/refunds/{id}),
  // per §9. This is what makes an unsigned callbackurl POST safe to accept
  // at all: it can trigger a check, but it can never itself cause money to
  // move.
  await reconcileOneRefund(supabaseAdmin, refund.id);
}

// Called from backend/hono.ts for the account-wide Paystack/Flutterwave
// webhook. Dispatches to the provider-specific handler above; both funnel
// into the same reconcileOneRefund for the actual state transition.
export async function processRefundWebhookEvent(
  supabaseAdmin: SupabaseClient,
  provider: "paystack" | "flutterwave",
  payload: RefundWebhookPayload | any
): Promise<void> {
  if (provider === "flutterwave") {
    await processFlutterwaveRefundNotification(supabaseAdmin, payload, "webhook");
    return;
  }
  await processPaystackRefundWebhookEvent(supabaseAdmin, payload);
}

// Called from backend/hono.ts for POST /webhooks/flutterwave-refund-callback
// — the callbackurl target passed on refund creation (see
// executeWalletTopupRefund). Exists because Flutterwave's account-wide
// refund webhook is OFF by default (confirmed live from their docs) and
// requires contacting Flutterwave support to enable, while callbackurl is a
// per-request parameter needing no such setup — making it the more
// reliably-delivered path in practice. Converges into the exact same
// handler as the webhook; see processFlutterwaveRefundNotification's own
// comment for why an unconfirmed-signature source is still safe to accept.
export async function processFlutterwaveRefundCallback(supabaseAdmin: SupabaseClient, payload: any): Promise<void> {
  await processFlutterwaveRefundNotification(supabaseAdmin, payload, "callback");
}
