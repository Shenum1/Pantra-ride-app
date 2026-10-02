// The ONE place that turns a payout request into a provider transfer, and
// the ONE place that turns a provider transfer outcome (webhook or explicit
// status check) into a driver_payouts state transition. Mirrors
// backend/lib/payment-processor.ts's role for wallet top-ups: automatic
// initiation (backend/trpc/routes/driver/payouts/request), the transfer
// webhooks (backend/hono.ts), and reconciliation (admin.payouts.reconciliation.*)
// all funnel through this file — there is never a second, divergent
// implementation of "call the provider" or "apply a provider outcome."
//
// Provider-dispatching: a payout's provider is decided ONCE (from
// DRIVER_PAYOUT_CONFIG.provider, at reference-generation time) and persisted
// on the row; every later step — retry, reconciliation, webhook — reads it
// back from the row rather than re-deciding, so a payout never switches
// providers mid-flight (its reference has already been submitted to one).

import { SupabaseClient } from "@supabase/supabase-js";
import { DRIVER_PAYOUT_CONFIG } from "../../lib/pricing-config";
import { decryptAccountNumber } from "./bank-account-crypto";
import {
  initiateFlutterwaveTransfer,
  mapFlutterwaveTransferStatus,
  resolveFlutterwaveAccountName,
  verifyFlutterwaveTransfer,
} from "./flutterwave-payout-provider";
import { resolveBankCode } from "./nigerian-banks";
import {
  createPaystackTransferRecipient,
  generatePayoutReference,
  initiatePaystackTransfer,
  PayoutProviderState,
  verifyPaystackTransfer,
} from "./payout-provider";

export type PayoutProvider = "paystack" | "flutterwave";

function asProvider(value: string | null | undefined): PayoutProvider | null {
  return value === "paystack" || value === "flutterwave" ? value : null;
}

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
  recipientVerifiedAt: string | null;
}

interface ProviderVerifyResult {
  found: boolean;
  providerState: PayoutProviderState;
  amount: number | null;
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
    .select("id, bankName, accountName, accountNumberEncrypted, accountNumber, bankCode, paystackRecipientCode, recipientVerifiedAt")
    .eq("id", bankAccountId)
    .maybeSingle<BankAccountRow>();
  if (error) throw new Error(`Failed to load bank account: ${error.message}`);
  return data;
}

function readAccountNumber(bankAccount: BankAccountRow): string | null {
  return bankAccount.accountNumberEncrypted
    ? decryptAccountNumber(bankAccount.accountNumberEncrypted)
    : bankAccount.accountNumber;
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

function isSettledForReconciliation(status: string): boolean {
  return status === "manual_review" || status === "completed" || status === "failed";
}

// For a Flutterwave payout whose transfer id was never captured: can a
// transfer nonetheless exist on Flutterwave's side? Only 'call_rejected'
// proves it can't — Flutterwave answered and refused, so nothing was
// created. Any other attempt outcome (still in flight, timed out, network
// failure, duplicate reference, or "succeeded" without an id) leaves real
// money possibly sent, and Pantra has no way to look it up by reference.
// No attempts at all means the provider was never called.
export function flutterwaveTransferMayExist(attemptStatuses: string[]): boolean {
  return attemptStatuses.some((status) => status !== "call_rejected");
}

async function loadAttemptStatuses(supabaseAdmin: SupabaseClient, payoutId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("payout_provider_attempts")
    .select("attemptStatus")
    .eq("payoutId", payoutId);
  if (error) throw new Error(`Failed to load payout provider attempts: ${error.message}`);
  return (data ?? []).map((row: { attemptStatus: string }) => row.attemptStatus);
}

export interface ReconcileResult {
  status: boolean;
  message: string;
  // True when the provider can't be asked about this payout and a transfer
  // might exist anyway — callers that are about to pay manually must not
  // proceed without a human confirming against the provider's dashboard.
  unverifiable?: boolean;
}

// Asks the payout's provider directly what it knows about the transfer and
// applies ONLY the transitions that are safe without ever sending money:
// recognizing a provider-confirmed success/failure/reversal that already
// happened. Never initiates a new transfer. Shared by four callers: the
// timeout/duplicate-reference recovery path inside initiateAutomaticPayout,
// the Flutterwave transfer webhook (which never trusts its own payload — see
// processPayoutWebhookEvent), admin.payouts.reconciliation.run (sweep), and
// .checkOne (spot check) — one implementation, not four.
//
// candidateFlutterwaveTransferId: a Flutterwave transfer id supplied by a
// webhook for a payout whose own create-transfer response was lost (so
// providerTransferCode was never captured). It is only ever used for a live
// lookup, and only persisted once that lookup proves the transfer carries
// THIS payout's reference — never trusted on its own.
export async function reconcileOnePayout(
  supabaseAdmin: SupabaseClient,
  payoutId: string,
  opts: { candidateFlutterwaveTransferId?: string } = {}
): Promise<ReconcileResult> {
  const payout = await loadPayout(supabaseAdmin, payoutId);
  if (!payout) return { status: false, message: "Payout not found." };
  const provider = asProvider(payout.provider);
  if (!payout.providerTransferReference || !provider) {
    return { status: false, message: "No automatic transfer has been initiated for this payout yet." };
  }
  if (payout.status === "reversed") {
    return { status: true, message: "Payout already reversed — nothing to reconcile." };
  }

  const reference = payout.providerTransferReference;
  let verify: ProviderVerifyResult;

  if (provider === "flutterwave") {
    const transferId = payout.providerTransferCode ?? opts.candidateFlutterwaveTransferId ?? null;
    if (!transferId) {
      // Flutterwave's GET /v3/transfers/{id} needs Flutterwave's own id, and
      // no lookup-by-reference endpoint for transfers is confirmed to exist —
      // so with no id, Flutterwave can't be asked. Whether that matters
      // depends on what the automatic attempts actually did.
      const attemptStatuses = await loadAttemptStatuses(supabaseAdmin, payoutId);

      if (!flutterwaveTransferMayExist(attemptStatuses)) {
        // Every attempt was refused outright (e.g. IP whitelisting not
        // enabled) — nothing was created, nothing to reconcile, and paying
        // this driver manually cannot double-pay them.
        if (payout.status === "processing") {
          await moveToManualReview(
            supabaseAdmin,
            payoutId,
            "No Flutterwave transfer was created for this payout — it needs to be paid manually or retried."
          );
        }
        return { status: false, message: "No Flutterwave transfer was ever created for this payout — safe to pay manually." };
      }

      // A transfer may exist (timeout, lost response, duplicate reference)
      // but can't be looked up. Hand off to a human rather than guess; a
      // later transfer.completed webhook can still self-heal this via
      // candidateFlutterwaveTransferId. The reconciliation record is written
      // once, when the payout first lands in review — not on every re-check.
      if (!isSettledForReconciliation(payout.status)) {
        await moveToManualReview(
          supabaseAdmin,
          payoutId,
          `An automatic Flutterwave transfer may have been sent but can't be looked up. Search the Flutterwave dashboard for reference ${reference} before paying this driver manually.`
        );
        await recordPayoutReconciliation(supabaseAdmin, {
          payoutId,
          provider,
          reference,
          expectedAmount: payout.amount,
          providerAmount: null,
          currency: "NGN",
          pantraStatus: payout.status,
          providerStatus: "unknown",
          mismatchType: "payout_unresolved_after_timeout",
        });
      }
      return {
        status: false,
        message: "A Flutterwave transfer may exist for this payout but can't be looked up — requires checking the Flutterwave dashboard.",
        unverifiable: true,
      };
    }

    const fw = await verifyFlutterwaveTransfer(transferId);
    if (fw.found && fw.reference !== reference) {
      // The id points at a real transfer — just not this payout's. Never
      // apply another transfer's outcome to this payout.
      if (!isSettledForReconciliation(payout.status)) {
        await moveToManualReview(
          supabaseAdmin,
          payoutId,
          `Flutterwave transfer ${transferId} carries reference "${fw.reference ?? "none"}", not this payout's reference — requires manual verification.`
        );
      }
      await recordPayoutReconciliation(supabaseAdmin, {
        payoutId,
        provider,
        reference,
        expectedAmount: payout.amount,
        providerAmount: fw.amount,
        currency: "NGN",
        pantraStatus: payout.status,
        providerStatus: fw.providerState,
        mismatchType: "payout_unmatched_provider_transaction",
      });
      return { status: false, message: "Provider transfer does not match this payout's reference." };
    }
    if (fw.found && !payout.providerTransferCode) {
      await supabaseAdmin.from("driver_payouts").update({ providerTransferCode: transferId }).eq("id", payoutId);
    }
    verify = fw;
  } else {
    verify = await verifyPaystackTransfer(reference);
  }

  if (!verify.found) {
    if (!isSettledForReconciliation(payout.status)) {
      await moveToManualReview(
        supabaseAdmin,
        payoutId,
        "Provider has no record of this transfer reference — requires manual verification before any retry."
      );
    }
    await recordPayoutReconciliation(supabaseAdmin, {
      payoutId,
      provider,
      reference,
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
        provider,
        reference,
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
          provider,
          providerTransferReference: reference,
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
          provider,
          providerTransferReference: reference,
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
          provider,
          providerTransferReference: reference,
          eventType: "reconciliation_check",
          providerState: verify.providerState,
          processingStatus: "processed",
        });
        await recordPayoutReconciliation(supabaseAdmin, {
          payoutId,
          provider,
          reference,
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
// human). "Transfer created" from a provider's initiation response is not the
// same as "money delivered."
export async function initiateAutomaticPayout(supabaseAdmin: SupabaseClient, payoutId: string): Promise<void> {
  const payout = await loadPayout(supabaseAdmin, payoutId);
  if (!payout) return;
  if (payout.status !== "pending" && payout.status !== "processing") return;

  // A payout that already has a provider (a retry) keeps it — its reference
  // may already have been submitted there. Only a fresh payout picks up the
  // configured default.
  const provider: PayoutProvider = asProvider(payout.provider) ?? DRIVER_PAYOUT_CONFIG.provider;

  const bankAccount = await loadBankAccount(supabaseAdmin, payout.bankAccountId);
  if (!bankAccount) {
    await moveToManualReview(supabaseAdmin, payoutId, "No bank account on file for automatic transfer.");
    return;
  }

  // driver_bank_accounts.bankCode caches a PAYSTACK code (see
  // backend/lib/nigerian-banks.ts — several banks' codes differ between
  // providers, and one Paystack code is a different bank on Flutterwave).
  // So the cache is only ever used for Paystack; Flutterwave always resolves
  // fresh from the bank name with its own codes (a pure, cheap lookup).
  let bankCode: string | null;
  if (provider === "paystack") {
    bankCode = bankAccount.bankCode;
    if (!bankCode) {
      bankCode = resolveBankCode(bankAccount.bankName, "paystack");
      if (bankCode) {
        await supabaseAdmin.from("driver_bank_accounts").update({ bankCode }).eq("id", bankAccount.id);
      }
    }
  } else {
    bankCode = resolveBankCode(bankAccount.bankName, "flutterwave");
  }
  if (!bankCode) {
    await moveToManualReview(
      supabaseAdmin,
      payoutId,
      `Could not resolve a bank code for "${bankAccount.bankName}" — automatic transfer requires manual processing.`
    );
    return;
  }

  // Provider-specific destination: Paystack needs a persistent recipient
  // code (created once, cached on the bank account); Flutterwave has no
  // recipient object and takes the raw account number on every transfer, so
  // the account is verified (once) via /v3/accounts/resolve instead.
  let recipientCode: string | null = null;
  let accountNumber: string | null = null;

  if (provider === "paystack") {
    recipientCode = bankAccount.paystackRecipientCode;
    if (!recipientCode) {
      const plain = readAccountNumber(bankAccount);
      if (!plain) {
        await moveToManualReview(supabaseAdmin, payoutId, "Bank account number is unavailable for automatic transfer.");
        return;
      }
      const recipientResult = await createPaystackTransferRecipient({
        accountNumber: plain,
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
  } else {
    accountNumber = readAccountNumber(bankAccount);
    if (!accountNumber) {
      await moveToManualReview(supabaseAdmin, payoutId, "Bank account number is unavailable for automatic transfer.");
      return;
    }
    if (!bankAccount.recipientVerifiedAt) {
      const resolved = await resolveFlutterwaveAccountName({ accountNumber, bankCode });
      if (!resolved.ok) {
        await moveToManualReview(
          supabaseAdmin,
          payoutId,
          `Could not verify the bank account with Flutterwave: ${resolved.message}`
        );
        return;
      }
      await supabaseAdmin
        .from("driver_bank_accounts")
        .update({ recipientVerifiedAt: new Date().toISOString() })
        .eq("id", bankAccount.id);
    }
  }

  // The idempotency key: generated once, persisted BEFORE ever calling the
  // provider, and reused on every retry of this same payout (including
  // admin.payouts.retry) — so the provider's own reference-uniqueness check
  // becomes a second, provider-side backstop on top of the DB-level guard
  // below. The provider is persisted in the same write: this is the single
  // point where DRIVER_PAYOUT_CONFIG.provider takes effect.
  let reference = payout.providerTransferReference;
  if (!reference) {
    reference = generatePayoutReference();
    const { error } = await supabaseAdmin
      .from("driver_payouts")
      .update({ providerTransferReference: reference, provider })
      .eq("id", payoutId);
    if (error) throw new Error(`Failed to persist payout transfer reference: ${error.message}`);
  }

  // The concurrency guard: at most one in-flight attempt per payout. A
  // second, simultaneous call (double-tap, client retry racing a slow first
  // request) fails this insert via idx_payout_provider_attempts_inflight and
  // must not call the provider again.
  const { error: attemptInsertError } = await supabaseAdmin.from("payout_provider_attempts").insert({
    payoutId,
    provider,
    providerTransferReference: reference,
    attemptStatus: "call_initiated",
  });
  if (attemptInsertError) {
    if (attemptInsertError.code === "23505") {
      return; // another attempt is already in flight — its outcome (or a later webhook/reconciliation pass) owns this payout
    }
    throw new Error(`Failed to record payout provider attempt: ${attemptInsertError.message}`);
  }

  const transferResult =
    provider === "flutterwave"
      ? await initiateFlutterwaveTransfer({ amount: payout.amount, accountNumber: accountNumber as string, bankCode, reference })
      : await initiatePaystackTransfer({ amount: payout.amount, recipientCode: recipientCode as string, reference });

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
      provider,
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
    // Either the provider says this exact reference was already used, or we
    // genuinely don't know whether our request reached them — in both
    // cases, ask the provider what it actually knows rather than guessing or
    // retrying blindly. This is the "provider timeout / unknown result"
    // protection required by the spec.
    await supabaseAdmin
      .from("driver_payouts")
      .update({ status: "processing", processingStartedAt: new Date().toISOString() })
      .eq("id", payoutId);
    await reconcileOnePayout(supabaseAdmin, payoutId);
    return;
  }

  // A clear provider-side rejection (bad account, insufficient provider
  // balance, invalid amount, etc.) — an operational issue, not something to
  // silently retry.
  await moveToManualReview(supabaseAdmin, payoutId, `Automatic transfer was rejected by the provider: ${transferResult.message}`);
  await recordPayoutEvent(supabaseAdmin, {
    payoutId,
    provider,
    providerTransferReference: reference,
    eventType: "transfer_initiation_rejected",
    processingStatus: "flagged_for_manual_review",
    failureReason: transferResult.message,
  });
}

// Paystack-only: Paystack names each outcome as its own event type.
// Flutterwave sends `transfer.completed` for every outcome and carries the
// result in data.status instead (verified live) — see
// mapFlutterwaveTransferStatus.
function mapPaystackEventTypeToState(eventType: string): PayoutProviderState {
  if (eventType === "transfer.success") return "successful";
  if (eventType === "transfer.failed") return "failed";
  if (eventType === "transfer.reversed") return "reversed";
  return "unknown";
}

export interface PayoutWebhookPayload {
  event?: string;
  data?: any;
}

// Called from backend/hono.ts for Paystack transfer.* events and Flutterwave
// transfer.completed events (each provider's single registered webhook URL,
// dispatched by event type). Never trusts the payload's own outcome without
// first matching it to a specific Pantra payout by the reference WE generated.
//
// The two providers differ in how much the payload itself is trusted:
// Paystack signs every payload with an HMAC over the raw body, so its signed
// outcome is applied directly. Flutterwave's verif-hash is a static shared
// secret — anyone who obtains it can forge any payload — and a forged FAILED
// would release the driver's balance reservation and allow a second payout
// while the first may actually have landed. So a Flutterwave transfer
// webhook is a notification only: the transition comes from a live
// GET /v3/transfers/{id} via reconcileOnePayout, same rule Flutterwave refund
// webhooks already follow (backend/lib/refund-processor.ts).
export async function processPayoutWebhookEvent(
  supabaseAdmin: SupabaseClient,
  provider: PayoutProvider,
  payload: PayoutWebhookPayload
): Promise<void> {
  const data = payload?.data ?? {};
  const reference = data.reference;
  const eventType = payload?.event ?? "unknown";
  // Flutterwave reuses one event name for every outcome of a transfer, so its
  // dedup key must include the status — otherwise a later, meaningful status
  // for the same transfer id would be swallowed as a "duplicate".
  const providerEventId =
    data.id != null ? (provider === "flutterwave" ? `${data.id}:${data.status ?? ""}` : String(data.id)) : undefined;
  const providerState =
    provider === "flutterwave" ? mapFlutterwaveTransferStatus(data.status) : mapPaystackEventTypeToState(eventType);
  // Paystack reports kobo; Flutterwave reports naira directly.
  const amount = data.amount != null ? (provider === "flutterwave" ? Number(data.amount) : Number(data.amount) / 100) : null;
  const currency = data.currency ?? "NGN";

  if (!reference || typeof reference !== "string") {
    console.error("Payout webhook received with no transfer reference — ignoring.", { provider, eventType });
    return;
  }

  const { data: payout, error: payoutError } = await supabaseAdmin
    .from("driver_payouts")
    .select("id, driverId, amount, status, providerTransferCode")
    .eq("providerTransferReference", reference)
    .maybeSingle();

  if (payoutError) throw new Error(`Failed to look up payout by transfer reference: ${payoutError.message}`);

  if (!payout) {
    await recordPayoutEvent(supabaseAdmin, {
      payoutId: null,
      provider,
      providerTransferReference: reference,
      providerEventId,
      eventType,
      processingStatus: "rejected_unmatched_payout",
      failureReason: "No matching driver_payouts row for this transfer reference.",
    });
    await recordPayoutReconciliation(supabaseAdmin, {
      payoutId: null,
      provider,
      reference,
      expectedAmount: null,
      providerAmount: amount,
      currency,
      pantraStatus: null,
      providerStatus: null,
      mismatchType: "payout_unmatched_provider_transaction",
    });
    return;
  }

  if (payout.status === "completed" || payout.status === "failed" || payout.status === "reversed") {
    await recordPayoutEvent(supabaseAdmin, {
      payoutId: payout.id,
      provider,
      providerTransferReference: reference,
      providerEventId,
      eventType,
      processingStatus: "ignored_duplicate",
    });
    return;
  }

  const recordedFresh = await recordPayoutEvent(supabaseAdmin, {
    payoutId: payout.id,
    provider,
    providerTransferReference: reference,
    providerEventId,
    eventType,
    providerState,
    amount,
    currency,
    processingStatus: "received",
  });
  if (!recordedFresh) return; // duplicate delivery of an event already fully recorded

  if (provider === "flutterwave") {
    await reconcileOnePayout(supabaseAdmin, payout.id, {
      candidateFlutterwaveTransferId: !payout.providerTransferCode && data.id != null ? String(data.id) : undefined,
    });
    return;
  }

  if (providerState === "successful") {
    if (amount != null && amount !== payout.amount) {
      await moveToManualReview(
        supabaseAdmin,
        payout.id,
        `Provider confirms transfer succeeded but for a different amount (expected ${payout.amount}, provider ${amount}).`
      );
      await recordPayoutReconciliation(supabaseAdmin, {
        payoutId: payout.id,
        provider,
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
        provider,
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
