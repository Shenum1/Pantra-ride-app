import { SupabaseClient } from "@supabase/supabase-js";
import { verifyPaystackTransaction, verifyFlutterwaveTransaction, ProviderState } from "./payment-providers";

// The ONE place that turns a provider-confirmed payment into a wallet
// credit. Both the webhook routes (backend/hono.ts) and the client-facing
// payments.wallet.credit tRPC route call this — there must never be a
// second, divergent implementation of "verify then credit."
//
// Reuses add_wallet_transaction (database/schemas/supabase-schema-wallet.sql,
// unmodified) for the actual money movement — its existing partial unique
// index on wallet_transactions("reference") is what makes this function safe
// under real concurrency (two simultaneous calls for the same reference:
// one INSERT wins, the other catches unique_violation and gets the
// pre-existing row back). This function does not reimplement that
// guarantee, it relies on it.

export type PaymentSourceChannel = "webhook" | "client_verification" | "admin_reconciliation";

export interface ProcessVerifiedPaymentParams {
  supabaseAdmin: SupabaseClient;
  provider: "paystack" | "flutterwave";
  reference: string;
  sourceChannel: PaymentSourceChannel;
  providerEventId?: string;
  eventType: string;
  // Set only for client_verification — cross-checked against the intent's
  // own userId so a rider can never redeem another rider's payment
  // reference for a wallet credit.
  callingUserId?: string;
  // Optional descriptive tag for which saved payment method funded this
  // top-up (wallet_transactions.paymentMethodId is a plain text label, not
  // a FK) — only ever supplied by the client_verification caller, since
  // that's the point in the original flow where the rider had already
  // chosen one. Falls back to the intent's own value, then to the provider
  // name, exactly matching the pre-Phase-2 default.
  paymentMethodId?: string;
  // Set only by the reconciliation "spot check" action — forces
  // re-verification even if the intent is already terminal, purely to
  // detect (never to mutate) a successful-Pantra/failed-provider
  // contradiction. Every other caller leaves this false.
  forceRecheck?: boolean;
}

export interface ProcessVerifiedPaymentResult {
  status: boolean;
  message: string;
  transaction?: unknown;
}

interface PaymentIntentRow {
  id: string;
  userId: string;
  provider: "paystack" | "flutterwave";
  reference: string;
  expectedAmount: number;
  currency: string;
  status: string;
  paymentMethodId: string | null;
}

function safeMetadataFrom(verification: { amount: number | null; currency: string | null; raw: any }) {
  const data = verification.raw?.data ?? {};
  return {
    status: data.status ?? null,
    amount: verification.amount,
    currency: verification.currency,
    paidAt: data.paid_at ?? data.created_at ?? null,
    channel: data.channel ?? data.payment_type ?? null,
  };
}

async function recordEvent(
  supabaseAdmin: SupabaseClient,
  fields: {
    paymentIntentId: string | null;
    provider: string;
    reference: string;
    providerEventId?: string | null;
    eventType: string;
    sourceChannel: PaymentSourceChannel;
    providerState?: ProviderState | null;
    amount?: number | null;
    currency?: string | null;
    processingStatus: string;
    failureReason?: string | null;
    safeMetadata?: Record<string, unknown> | null;
  }
): Promise<void> {
  const { error } = await supabaseAdmin.from("payment_events").insert({
    paymentIntentId: fields.paymentIntentId,
    provider: fields.provider,
    reference: fields.reference,
    providerEventId: fields.providerEventId ?? null,
    eventType: fields.eventType,
    sourceChannel: fields.sourceChannel,
    providerState: fields.providerState ?? null,
    amount: fields.amount ?? null,
    currency: fields.currency ?? null,
    processingStatus: fields.processingStatus,
    failureReason: fields.failureReason ?? null,
    safeMetadata: fields.safeMetadata ?? null,
    processedAt: new Date().toISOString(),
  });

  // A duplicate webhook delivery with the same (provider, providerEventId)
  // hits the unique index here and throws — that IS the dedup working as
  // intended for a webhook re-delivery of an event already fully recorded.
  // Anything else (a genuine DB failure) must propagate so the caller (a
  // webhook route) surfaces a 5xx and the provider retries, per the
  // "don't acknowledge before durably recording" rule — so this only
  // swallows the specific unique_violation case.
  if (error && error.code !== "23505") {
    throw new Error(`Failed to record payment event: ${error.message}`);
  }
}

async function updateIntentStatus(
  supabaseAdmin: SupabaseClient,
  intentId: string,
  status: string
): Promise<void> {
  // A no-op update (setting the same status the intent already has) is
  // harmless — the terminal-lock trigger only rejects a CHANGE away from
  // successful/failed, and Postgres's IS DISTINCT FROM check in that
  // trigger already treats "same value" as not a change.
  const { error } = await supabaseAdmin
    .from("payment_intents")
    .update({ status, updatedAt: new Date().toISOString() })
    .eq("id", intentId);
  if (error) {
    throw new Error(`Failed to update payment intent status: ${error.message}`);
  }
}

export async function processVerifiedPayment(
  params: ProcessVerifiedPaymentParams
): Promise<ProcessVerifiedPaymentResult> {
  const { supabaseAdmin, provider, reference, sourceChannel, providerEventId, eventType, callingUserId, forceRecheck, paymentMethodId } = params;

  const { data: intent, error: intentError } = await supabaseAdmin
    .from("payment_intents")
    .select("id, userId, provider, reference, expectedAmount, currency, status, paymentMethodId")
    .eq("reference", reference)
    .maybeSingle<PaymentIntentRow>();

  if (intentError) {
    throw new Error(`Failed to look up payment intent: ${intentError.message}`);
  }

  // Case F / §19 "fake reference": nothing to credit against. Recorded as
  // both an event and a reconciliation record — a provider transaction that
  // doesn't correspond to anything Pantra initiated is itself worth
  // reviewing (could be a forged webhook, could be a real transaction from
  // a stale/pre-migration reference format).
  if (!intent) {
    await recordEvent(supabaseAdmin, {
      paymentIntentId: null,
      provider,
      reference,
      providerEventId,
      eventType,
      sourceChannel,
      processingStatus: "rejected_unmatched_intent",
      failureReason: "No matching payment_intents row for this reference.",
    });
    await supabaseAdmin.from("payment_reconciliation_records").insert({
      paymentIntentId: null,
      provider,
      reference,
      mismatchType: "unmatched_provider_transaction",
      notes: `sourceChannel=${sourceChannel}`,
    });
    return { status: false, message: "Payment reference not recognized." };
  }

  // §11/§19: a rider must never be able to redeem another rider's reference.
  if (sourceChannel === "client_verification" && callingUserId && callingUserId !== intent.userId) {
    return { status: false, message: "This payment reference does not belong to your account." };
  }

  // Already terminal and this isn't the reconciliation spot-check path:
  // short-circuit without re-verifying or touching the wallet again. Cheap,
  // and correctly makes "webhook x 20" for an already-processed reference a
  // near-no-op.
  if ((intent.status === "successful" || intent.status === "failed") && !forceRecheck) {
    await recordEvent(supabaseAdmin, {
      paymentIntentId: intent.id,
      provider,
      reference,
      providerEventId,
      eventType,
      sourceChannel,
      processingStatus: "ignored_duplicate",
    });
    return {
      status: intent.status === "successful",
      message: intent.status === "successful" ? "Payment already processed." : "This payment previously failed.",
    };
  }

  const verification =
    provider === "paystack" ? await verifyPaystackTransaction(reference) : await verifyFlutterwaveTransaction(reference);

  // forceRecheck (the reconciliation spot-check): only ever used to DETECT a
  // contradiction on an already-terminal intent, never to mutate it — the
  // terminal-lock trigger would reject any status change away from
  // 'successful'/'failed' anyway, so this branch returns before ever
  // reaching updateIntentStatus/add_wallet_transaction below, for either
  // terminal state.
  if (forceRecheck && (intent.status === "successful" || intent.status === "failed")) {
    const contradiction =
      (intent.status === "successful" && verification.providerState === "failed") ||
      (intent.status === "failed" && verification.providerState === "successful");

    if (intent.status === "successful" && verification.providerState === "failed") {
      // The one contradiction direction the schema models (§ of the plan) —
      // a genuinely actionable case: Pantra already credited a wallet for a
      // payment the provider now disowns.
      await supabaseAdmin.from("payment_reconciliation_records").insert({
        paymentIntentId: intent.id,
        provider,
        reference,
        expectedAmount: intent.expectedAmount,
        providerAmount: verification.amount,
        currency: intent.currency,
        pantraStatus: intent.status,
        providerStatus: verification.providerState,
        mismatchType: "pantra_success_provider_failed",
      });
    } else if (contradiction) {
      // intent.status === 'failed' && providerState === 'successful' — the
      // reverse direction. Extremely unusual (Paystack/Flutterwave don't
      // normally "resurrect" a charge under the same reference) and not
      // part of the reconciliation schema's mismatchType enum — logged
      // loudly rather than silently dropped, but deliberately not widening
      // the DB enum for a case this rare; a human reviewing logs is the
      // documented handling for now.
      console.error(
        `Reconciliation contradiction: payment_intents ${intent.id} (reference=${reference}) is marked 'failed' but the provider now reports success. No wallet credit was issued — manual review required.`
      );
    }

    return contradiction
      ? { status: false, message: "Contradiction detected between Pantra's recorded status and the provider's current status." }
      : { status: true, message: "No contradiction found — provider status matches Pantra's recorded outcome." };
  }

  if (verification.providerState === "failed") {
    await updateIntentStatus(supabaseAdmin, intent.id, "failed");
    await recordEvent(supabaseAdmin, {
      paymentIntentId: intent.id, provider, reference, providerEventId, eventType, sourceChannel,
      providerState: verification.providerState, processingStatus: "provider_failed",
      failureReason: verification.message, safeMetadata: safeMetadataFrom(verification),
    });
    return { status: false, message: "Payment failed at the provider." };
  }

  if (verification.providerState === "pending") {
    await updateIntentStatus(supabaseAdmin, intent.id, "pending");
    await recordEvent(supabaseAdmin, {
      paymentIntentId: intent.id, provider, reference, providerEventId, eventType, sourceChannel,
      providerState: verification.providerState, processingStatus: "provider_pending",
      safeMetadata: safeMetadataFrom(verification),
    });
    return { status: false, message: "Payment is still processing." };
  }

  if (verification.providerState === "unknown") {
    // Deliberately NOT 'failed' — a transient/undeterminable provider
    // response must stay retryable, per the correction to this plan.
    await updateIntentStatus(supabaseAdmin, intent.id, "unknown");
    await recordEvent(supabaseAdmin, {
      paymentIntentId: intent.id, provider, reference, providerEventId, eventType, sourceChannel,
      providerState: verification.providerState, processingStatus: "provider_unknown",
      failureReason: verification.message,
    });
    return { status: false, message: "Could not confirm payment status right now. Please try again shortly." };
  }

  // providerState === 'successful' from here on.
  if (verification.amount !== intent.expectedAmount) {
    await updateIntentStatus(supabaseAdmin, intent.id, "unknown");
    await recordEvent(supabaseAdmin, {
      paymentIntentId: intent.id, provider, reference, providerEventId, eventType, sourceChannel,
      providerState: verification.providerState, amount: verification.amount, currency: verification.currency,
      processingStatus: "rejected_amount_mismatch",
      failureReason: `Expected ${intent.expectedAmount}, provider confirmed ${verification.amount}.`,
      safeMetadata: safeMetadataFrom(verification),
    });
    await supabaseAdmin.from("payment_reconciliation_records").insert({
      paymentIntentId: intent.id, provider, reference,
      expectedAmount: intent.expectedAmount, providerAmount: verification.amount, currency: verification.currency,
      pantraStatus: "unknown", providerStatus: verification.providerState, mismatchType: "amount_mismatch",
    });
    return { status: false, message: "Amount mismatch detected. This payment requires manual review." };
  }

  if (verification.currency !== intent.currency) {
    await updateIntentStatus(supabaseAdmin, intent.id, "unknown");
    await recordEvent(supabaseAdmin, {
      paymentIntentId: intent.id, provider, reference, providerEventId, eventType, sourceChannel,
      providerState: verification.providerState, amount: verification.amount, currency: verification.currency,
      processingStatus: "rejected_currency_mismatch",
      failureReason: `Expected ${intent.currency}, provider confirmed ${verification.currency}.`,
      safeMetadata: safeMetadataFrom(verification),
    });
    await supabaseAdmin.from("payment_reconciliation_records").insert({
      paymentIntentId: intent.id, provider, reference,
      expectedAmount: intent.expectedAmount, providerAmount: verification.amount, currency: verification.currency,
      pantraStatus: "unknown", providerStatus: verification.providerState, mismatchType: "currency_mismatch",
    });
    return { status: false, message: "Currency mismatch detected. This payment requires manual review." };
  }

  // Amount and currency both match — credit via the existing, unmodified
  // RPC. Its own partial-unique-index idempotency means this is safe to
  // call even if another concurrent caller (webhook vs. client-verify, or
  // two webhook deliveries) is doing the exact same thing right now: at
  // most one of them performs the real INSERT, the other gets the
  // pre-existing row back — both paths below treat that identically as
  // success.
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("add_wallet_transaction", {
    p_user_id: intent.userId,
    p_type: "add_money",
    p_amount: verification.amount,
    p_description: "Added money to wallet",
    p_status: "completed",
    p_ride_id: null,
    p_payment_method_id: paymentMethodId ?? intent.paymentMethodId ?? provider,
    p_reference: reference,
    p_metadata: null,
  });

  if (rpcError) {
    // A genuine DB failure here must propagate (not be swallowed into a
    // "handled" outcome) so a webhook caller's non-200 response causes the
    // provider to retry — the payment is NOT durably recorded as credited.
    throw new Error(`Wallet credit failed after verified payment: ${rpcError.message}`);
  }

  await updateIntentStatus(supabaseAdmin, intent.id, "successful");
  await recordEvent(supabaseAdmin, {
    paymentIntentId: intent.id, provider, reference, providerEventId, eventType, sourceChannel,
    providerState: verification.providerState, amount: verification.amount, currency: verification.currency,
    processingStatus: "processed", safeMetadata: safeMetadataFrom(verification),
  });

  const transaction = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  return { status: true, message: "Wallet credited", transaction };
}
