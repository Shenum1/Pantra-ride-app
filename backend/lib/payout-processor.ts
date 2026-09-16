// The ONE place that turns a payout request into a Paystack transfer, and
// the ONE place that turns a provider transfer outcome (webhook or explicit
// status check) into a driver_payouts state transition. Mirrors
// backend/lib/payment-processor.ts's role for wallet top-ups: automatic
// initiation (backend/trpc/routes/driver/payouts/request), the transfer
// webhook (backend/hono.ts), and reconciliation (admin.payouts.reconciliation.*)
// all funnel through this file — there is never a second, divergent
// implementation of "call the provider" or "apply a provider outcome."

import { SupabaseClient } from "@supabase/supabase-js";
import { decryptAccountNumber } from "./bank-account-crypto";
import { resolveBankCode } from "./nigerian-banks";
import {
  createPaystackTransferRecipient,
  generatePayoutReference,
  initiatePaystackTransfer,
  PayoutProviderState,
  verifyPaystackTransfer,
} from "./payout-provider";

interface PayoutRow {
  id: string;
  driverId: string;
  amount: number;
  bankAccountId: string | null;
  status: string;
  provider: string | null;
  providerTransferReference: string | null;
  providerTransferCode: string | null;
}

interface BankAccountRow {
  id: string;
  bankName: string;
  accountName: string;
  accountNumberEncrypted: string | null;
  accountNumber: string | null;
  bankCode: string | null;
  paystackRecipientCode: string | null;
}

async function loadPayout(supabaseAdmin: SupabaseClient, payoutId: string): Promise<PayoutRow | null> {
  const { data, error } = await supabaseAdmin
    .from("driver_payouts")
    .select("id, driverId, amount, bankAccountId, status, provider, providerTransferReference, providerTransferCode")
    .eq("id", payoutId)
    .maybeSingle<PayoutRow>();
  if (error) throw new Error(`Failed to load payout: ${error.message}`);
  return data;
}

async function loadBankAccount(supabaseAdmin: SupabaseClient, bankAccountId: string | null): Promise<BankAccountRow | null> {
  if (!bankAccountId) return null;
  const { data, error } = await supabaseAdmin
    .from("driver_bank_accounts")
    .select("id, bankName, accountName, accountNumberEncrypted, accountNumber, bankCode, paystackRecipientCode")
    .eq("id", bankAccountId)
    .maybeSingle<BankAccountRow>();
  if (error) throw new Error(`Failed to load bank account: ${error.message}`);
  return data;
}

// Returns false when the insert hit the (provider, providerEventId) unique
// index — a duplicate delivery of an event already fully recorded. Any other
// DB error propagates, same "never swallow a genuine failure" rule as
// payment-processor.ts's recordEvent.
async function recordPayoutEvent(
  supabaseAdmin: SupabaseClient,
  fields: {
    payoutId: string | null;
    provider: string;
    providerTransferReference?: string | null;
    providerEventId?: string;
    eventType: string;
    providerState?: PayoutProviderState | null;
    amount?: number | null;
    currency?: string | null;
    processingStatus: string;
    failureReason?: string | null;
    safeMetadata?: Record<string, unknown> | null;
  }
): Promise<boolean> {
  const { error } = await supabaseAdmin.from("payout_events").insert({
    payoutId: fields.payoutId,
    provider: fields.provider,
    providerTransferReference: fields.providerTransferReference ?? null,
    providerEventId: fields.providerEventId ?? null,
    eventType: fields.eventType,
    providerState: fields.providerState ?? null,
    amount: fields.amount ?? null,
    currency: fields.currency ?? null,
    processingStatus: fields.processingStatus,
    failureReason: fields.failureReason ?? null,
    safeMetadata: fields.safeMetadata ?? null,
    processedAt: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "23505") return false;
    throw new Error(`Failed to record payout event: ${error.message}`);
  }
  return true;
}

async function recordPayoutReconciliation(
  supabaseAdmin: SupabaseClient,
  fields: {
    payoutId: string | null;
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
    payoutId: fields.payoutId,
    provider: fields.provider,
    reference: fields.reference,
    expectedAmount: fields.expectedAmount,
    providerAmount: fields.providerAmount,
    currency: fields.currency,
    pantraStatus: fields.pantraStatus,
    providerStatus: fields.providerStatus,
    mismatchType: fields.mismatchType,
  });
  if (error) throw new Error(`Failed to record payout reconciliation record: ${error.message}`);
}

// Moves a payout into manual_review — the controlled entry point every
// automatic-path failure and every admin-initiated "hand this off" action
// goes through. adminUserId is set only for an admin-triggered call; left
// undefined for a system-triggered one (an audit row is still written either
// way, with adminUserId=null meaning "system"). Never throws on an invalid
// transition (e.g. the payout resolved to 'completed'/'reversed' concurrently)
// — logs and returns, since this is frequently called from a best-effort
// recovery path that must not itself crash the caller.
export async function moveToManualReview(
  supabaseAdmin: SupabaseClient,
  payoutId: string,
  reason: string,
  adminUserId?: string
): Promise<void> {
  const payout = await loadPayout(supabaseAdmin, payoutId);
  if (!payout) return;
  if (payout.status === "completed" || payout.status === "reversed") {
    console.error(`payout ${payoutId}: cannot move to manual_review from terminal status ${payout.status}.`);
    return;
  }
  if (payout.status === "manual_review") return;

  const { error } = await supabaseAdmin.from("driver_payouts").update({ status: "manual_review" }).eq("id", payoutId);
  if (error) {
    console.error(`payout ${payoutId}: failed to move to manual_review: ${error.message}`);
    return;
  }

  await supabaseAdmin.from("payout_manual_actions").insert({
    payoutId,
    adminUserId: adminUserId ?? null,
    action: "moved_to_manual_review",
    notes: reason,
  });
}

// Asks Paystack directly what it knows about a payout's transfer reference
// and applies ONLY the transitions that are safe without ever sending money:
// recognizing a provider-confirmed success/failure/reversal that already
// happened. Never initiates a new transfer. Shared by three callers: the
// timeout/duplicate-reference recovery path inside initiateAutomaticPayout,
// admin.payouts.reconciliation.run (sweep), and .checkOne (spot check) — one
// implementation, not three.
export async function reconcileOnePayout(
  supabaseAdmin: SupabaseClient,
  payoutId: string
): Promise<{ status: boolean; message: string }> {
  const payout = await loadPayout(supabaseAdmin, payoutId);
  if (!payout) return { status: false, message: "Payout not found." };
  if (!payout.providerTransferReference || payout.provider !== "paystack") {
    return { status: false, message: "No automatic transfer has been initiated for this payout yet." };
  }
  if (payout.status === "reversed") {
    return { status: true, message: "Payout already reversed — nothing to reconcile." };
  }

  const verify = await verifyPaystackTransfer(payout.providerTransferReference);

  if (!verify.found) {
    if (payout.status !== "manual_review" && payout.status !== "completed" && payout.status !== "failed") {
      await moveToManualReview(
        supabaseAdmin,
        payoutId,
        "Provider has no record of this transfer reference — requires manual verification before any retry."
      );
    }
    await recordPayoutReconciliation(supabaseAdmin, {
      payoutId,
      provider: "paystack",
      reference: payout.providerTransferReference,
      expectedAmount: payout.amount,
      providerAmount: null,
      currency: "NGN",
      pantraStatus: payout.status,
      providerStatus: "unknown",
      mismatchType: "payout_unmatched_provider_transaction",
    });
    return { status: false, message: "Provider has no record of this transfer." };
  }

  if (verify.providerState === "successful") {
    if (verify.amount != null && verify.amount !== payout.amount) {
      if (payout.status !== "completed" && payout.status !== "failed") {
        await moveToManualReview(
          supabaseAdmin,
          payoutId,
          `Provider confirms transfer succeeded but for a different amount (expected ${payout.amount}, provider ${verify.amount}).`
        );
      }
      await recordPayoutReconciliation(supabaseAdmin, {
        payoutId,
        provider: "paystack",
        reference: payout.providerTransferReference,
        expectedAmount: payout.amount,
        providerAmount: verify.amount,
        currency: "NGN",
        pantraStatus: payout.status,
        providerStatus: verify.providerState,
        mismatchType: "payout_amount_mismatch",
      });
      return { status: false, message: "Amount mismatch detected — requires manual review." };
    }

    if (payout.status !== "completed") {
      try {
        const { error } = await supabaseAdmin.from("driver_payouts").update({ status: "completed" }).eq("id", payoutId);
        if (error) throw new Error(error.message);
        await recordPayoutEvent(supabaseAdmin, {
          payoutId,
          provider: "paystack",
          providerTransferReference: payout.providerTransferReference,
          eventType: "reconciliation_check",
          providerState: verify.providerState,
          amount: verify.amount,
          currency: "NGN",
          processingStatus: "processed",
        });
      } catch (e) {
        console.error(`payout ${payoutId}: reconciliation could not apply completed transition: ${(e as Error).message}`);
        return { status: false, message: "Provider confirms success but the local transition was rejected — requires manual review." };
      }
    }
    return { status: true, message: "Provider confirms this payout succeeded." };
  }

  if (verify.providerState === "failed") {
    if (payout.status === "processing" || payout.status === "manual_review") {
      try {
        const { error } = await supabaseAdmin
          .from("driver_payouts")
          .update({ status: "failed", failureReason: "Provider confirmed transfer failed." })
          .eq("id", payoutId);
        if (error) throw new Error(error.message);
        await recordPayoutEvent(supabaseAdmin, {
          payoutId,
          provider: "paystack",
          providerTransferReference: payout.providerTransferReference,
          eventType: "reconciliation_check",
          providerState: verify.providerState,
          processingStatus: "processed",
        });
      } catch (e) {
        console.error(`payout ${payoutId}: reconciliation could not apply failed transition: ${(e as Error).message}`);
      }
    }
    return { status: false, message: "Provider confirms this transfer failed." };
  }

  if (verify.providerState === "reversed") {
    if (payout.status === "completed") {
      try {
        const { error } = await supabaseAdmin.from("driver_payouts").update({ status: "reversed" }).eq("id", payoutId);
        if (error) throw new Error(error.message);
        await recordPayoutEvent(supabaseAdmin, {
          payoutId,
          provider: "paystack",
          providerTransferReference: payout.providerTransferReference,
          eventType: "reconciliation_check",
          providerState: verify.providerState,
          processingStatus: "processed",
        });
        await recordPayoutReconciliation(supabaseAdmin, {
          payoutId,
          provider: "paystack",
          reference: payout.providerTransferReference,
          expectedAmount: payout.amount,
          providerAmount: verify.amount,
          currency: "NGN",
          pantraStatus: "completed",
          providerStatus: "reversed",
          mismatchType: "payout_provider_reversed",
        });
      } catch (e) {
        console.error(`payout ${payoutId}: reconciliation could not apply reversed transition: ${(e as Error).message}`);
      }
    }
    return { status: false, message: "Provider reports this transfer was reversed." };
  }

  // 'pending'/'unknown' — genuinely still in flight or undeterminable. No
  // transition, no reconciliation record: this is not yet a problem.
  return { status: false, message: "Provider has not yet confirmed a final outcome for this transfer." };
}

// The automatic-payout entry point — called once, synchronously, right after
// a new driver_payouts row is inserted (backend/trpc/routes/driver/payouts/request),
// and again by admin.payouts.retry after it transitions a failed/manual_review
// payout back to 'processing'. Never marks a payout 'completed' itself —
// only 'processing' (awaiting the webhook) or 'manual_review' (needs a
// human). See the implementation report for why: "transfer created" from
// Paystack's initiation response is not the same as "money delivered."
export async function initiateAutomaticPayout(supabaseAdmin: SupabaseClient, payoutId: string): Promise<void> {
  const payout = await loadPayout(supabaseAdmin, payoutId);
  if (!payout) return;
  if (payout.status !== "pending" && payout.status !== "processing") return;

  const bankAccount = await loadBankAccount(supabaseAdmin, payout.bankAccountId);
  if (!bankAccount) {
    await moveToManualReview(supabaseAdmin, payoutId, "No bank account on file for automatic transfer.");
    return;
  }

  let bankCode = bankAccount.bankCode;
  if (!bankCode) {
    bankCode = resolveBankCode(bankAccount.bankName);
    if (bankCode) {
      await supabaseAdmin.from("driver_bank_accounts").update({ bankCode }).eq("id", bankAccount.id);
    }
  }
  if (!bankCode) {
    await moveToManualReview(
      supabaseAdmin,
      payoutId,
      `Could not resolve a bank code for "${bankAccount.bankName}" — automatic transfer requires manual processing.`
    );
    return;
  }

  let recipientCode = bankAccount.paystackRecipientCode;
  if (!recipientCode) {
    const accountNumber = bankAccount.accountNumberEncrypted
      ? decryptAccountNumber(bankAccount.accountNumberEncrypted)
      : bankAccount.accountNumber;
    if (!accountNumber) {
      await moveToManualReview(supabaseAdmin, payoutId, "Bank account number is unavailable for automatic transfer.");
      return;
    }
    const recipientResult = await createPaystackTransferRecipient({
      accountNumber,
      bankCode,
      accountName: bankAccount.accountName,
    });
    if (!recipientResult.ok || !recipientResult.recipientCode) {
      await moveToManualReview(
        supabaseAdmin,
        payoutId,
        `Could not verify/create a transfer recipient: ${recipientResult.message}`
      );
      return;
    }
    recipientCode = recipientResult.recipientCode;
    await supabaseAdmin
      .from("driver_bank_accounts")
      .update({ paystackRecipientCode: recipientCode, recipientVerifiedAt: new Date().toISOString() })
      .eq("id", bankAccount.id);
  }

  // The idempotency key: generated once, persisted BEFORE ever calling
  // Paystack, and reused on every retry of this same payout (including
  // admin.payouts.retry) — so Paystack's own reference-uniqueness check
  // becomes a second, provider-side backstop on top of the DB-level guard
  // below.
  let reference = payout.providerTransferReference;
  if (!reference) {
    reference = generatePayoutReference();
    const { error } = await supabaseAdmin
      .from("driver_payouts")
      .update({ providerTransferReference: reference, provider: "paystack" })
      .eq("id", payoutId);
    if (error) throw new Error(`Failed to persist payout transfer reference: ${error.message}`);
  }

  // The concurrency guard: at most one in-flight attempt per payout. A
  // second, simultaneous call (double-tap, client retry racing a slow first
  // request) fails this insert via idx_payout_provider_attempts_inflight and
  // must not call the provider again.
  const { error: attemptInsertError } = await supabaseAdmin.from("payout_provider_attempts").insert({
    payoutId,
    provider: "paystack",
    providerTransferReference: reference,
    attemptStatus: "call_initiated",
  });
  if (attemptInsertError) {
    if (attemptInsertError.code === "23505") {
      return; // another attempt is already in flight — its outcome (or a later webhook/reconciliation pass) owns this payout
    }
    throw new Error(`Failed to record payout provider attempt: ${attemptInsertError.message}`);
  }

  const transferResult = await initiatePaystackTransfer({ amount: payout.amount, recipientCode, reference });

  await supabaseAdmin
    .from("payout_provider_attempts")
    .update({
      attemptStatus: transferResult.ok
        ? "call_succeeded"
        : transferResult.outcome === "duplicate_reference"
          ? "call_failed_duplicate_reference"
          : transferResult.outcome === "network_error"
            ? "call_timeout"
            : "call_rejected",
      providerTransferCode: transferResult.providerTransferCode,
      httpStatus: transferResult.httpStatus,
      failureReason: transferResult.ok ? null : transferResult.message,
      updatedAt: new Date().toISOString(),
    })
    .eq("payoutId", payoutId)
    .eq("attemptStatus", "call_initiated");

  if (transferResult.ok) {
    await supabaseAdmin
      .from("driver_payouts")
      .update({
        status: "processing",
        providerTransferCode: transferResult.providerTransferCode,
        processingStartedAt: new Date().toISOString(),
      })
      .eq("id", payoutId);

    await recordPayoutEvent(supabaseAdmin, {
      payoutId,
      provider: "paystack",
      providerTransferReference: reference,
      eventType: "transfer_initiated",
      providerState: transferResult.providerState,
      amount: payout.amount,
      currency: "NGN",
      processingStatus: "received",
    });
    return;
  }

  if (transferResult.outcome === "duplicate_reference" || transferResult.outcome === "network_error") {
    // Either Paystack says this exact reference was already used, or we
    // genuinely don't know whether our request reached them — in both
    // cases, ask Paystack what it actually knows rather than guessing or
    // retrying blindly. This is the "provider timeout / unknown result"
    // protection required by the spec.
    await supabaseAdmin
      .from("driver_payouts")
      .update({ status: "processing", processingStartedAt: new Date().toISOString() })
      .eq("id", payoutId);
    await reconcileOnePayout(supabaseAdmin, payoutId);
    return;
  }

  // A clear provider-side rejection (bad recipient, insufficient Paystack
  // balance, invalid amount, etc.) — an operational issue, not something to
  // silently retry.
  await moveToManualReview(supabaseAdmin, payoutId, `Automatic transfer was rejected by the provider: ${transferResult.message}`);
  await recordPayoutEvent(supabaseAdmin, {
    payoutId,
    provider: "paystack",
    providerTransferReference: reference,
    eventType: "transfer_initiation_rejected",
    processingStatus: "flagged_for_manual_review",
    failureReason: transferResult.message,
  });
}

function mapEventTypeToState(eventType: string): PayoutProviderState {
  if (eventType === "transfer.success") return "successful";
  if (eventType === "transfer.failed") return "failed";
  if (eventType === "transfer.reversed") return "reversed";
  return "unknown";
}

export interface PayoutWebhookPayload {
  event?: string;
  data?: any;
}

// Called from backend/hono.ts for every transfer.* Paystack webhook event
// (the same /webhooks/paystack endpoint charge.* events already use — one
// registered webhook URL, dispatched by event type). Never trusts the
// payload's own "successful" claim without having already matched it to a
// specific Pantra payout by the reference WE generated.
export async function processPayoutWebhookEvent(supabaseAdmin: SupabaseClient, payload: PayoutWebhookPayload): Promise<void> {
  const reference = payload?.data?.reference;
  const providerEventId = payload?.data?.id != null ? String(payload.data.id) : undefined;
  const eventType = payload?.event ?? "unknown";

  if (!reference || typeof reference !== "string") {
    console.error("Payout webhook received with no transfer reference — ignoring.", { eventType });
    return;
  }

  const { data: payout, error: payoutError } = await supabaseAdmin
    .from("driver_payouts")
    .select("id, driverId, amount, status")
    .eq("providerTransferReference", reference)
    .maybeSingle();

  if (payoutError) throw new Error(`Failed to look up payout by transfer reference: ${payoutError.message}`);

  if (!payout) {
    await recordPayoutEvent(supabaseAdmin, {
      payoutId: null,
      provider: "paystack",
      providerTransferReference: reference,
      providerEventId,
      eventType,
      processingStatus: "rejected_unmatched_payout",
      failureReason: "No matching driver_payouts row for this transfer reference.",
    });
    await recordPayoutReconciliation(supabaseAdmin, {
      payoutId: null,
      provider: "paystack",
      reference,
      expectedAmount: null,
      providerAmount: payload?.data?.amount != null ? Number(payload.data.amount) / 100 : null,
      currency: payload?.data?.currency ?? "NGN",
      pantraStatus: null,
      providerStatus: null,
      mismatchType: "payout_unmatched_provider_transaction",
    });
    return;
  }

  if (payout.status === "completed" || payout.status === "failed" || payout.status === "reversed") {
    await recordPayoutEvent(supabaseAdmin, {
      payoutId: payout.id,
      provider: "paystack",
      providerTransferReference: reference,
      providerEventId,
      eventType,
      processingStatus: "ignored_duplicate",
    });
    return;
  }

  const providerState = mapEventTypeToState(eventType);
  const amount = payload?.data?.amount != null ? Number(payload.data.amount) / 100 : null;
  const currency = payload?.data?.currency ?? "NGN";

  const recordedFresh = await recordPayoutEvent(supabaseAdmin, {
    payoutId: payout.id,
    provider: "paystack",
    providerTransferReference: reference,
    providerEventId,
    eventType,
    providerState,
    amount,
    currency,
    processingStatus: "received",
  });
  if (!recordedFresh) return; // duplicate delivery of an event already fully recorded

  if (providerState === "successful") {
    if (amount != null && amount !== payout.amount) {
      await moveToManualReview(
        supabaseAdmin,
        payout.id,
        `Provider confirms transfer succeeded but for a different amount (expected ${payout.amount}, provider ${amount}).`
      );
      await recordPayoutReconciliation(supabaseAdmin, {
        payoutId: payout.id,
        provider: "paystack",
        reference,
        expectedAmount: payout.amount,
        providerAmount: amount,
        currency,
        pantraStatus: "manual_review",
        providerStatus: providerState,
        mismatchType: "payout_amount_mismatch",
      });
      return;
    }
    await supabaseAdmin.from("driver_payouts").update({ status: "completed" }).eq("id", payout.id);
    return;
  }

  if (providerState === "failed") {
    await supabaseAdmin
      .from("driver_payouts")
      .update({ status: "failed", failureReason: "Provider confirmed transfer failed." })
      .eq("id", payout.id);
    return;
  }

  if (providerState === "reversed") {
    if (payout.status === "completed") {
      await supabaseAdmin.from("driver_payouts").update({ status: "reversed" }).eq("id", payout.id);
    } else {
      await recordPayoutReconciliation(supabaseAdmin, {
        payoutId: payout.id,
        provider: "paystack",
        reference,
        expectedAmount: payout.amount,
        providerAmount: amount,
        currency,
        pantraStatus: payout.status,
        providerStatus: providerState,
        mismatchType: "payout_provider_reversed",
      });
    }
    return;
  }

  // pending/unknown transfer.* event — already durably recorded above, no
  // transition to apply.
}
