// Provider refund API wrappers — the refund-side counterpart to
// backend/lib/payment-providers.ts (charges) and backend/lib/payout-provider.ts
// (transfers). Unlike Transfers, NEITHER provider's refund-creation endpoint
// accepts a client-supplied idempotency reference — Paystack's /refund takes
// only { transaction, amount }, Flutterwave's /transactions/:id/refund takes
// only { amount }. This is a real difference from the payout side: the
// DB-level protection in refund_provider_attempts (one in-flight attempt per
// refund, enforced by a partial unique index) is the PRIMARY idempotency
// guard here, not a secondary one on top of provider-side dedup — there is
// no provider-side dedup to lean on for refunds.

import { randomUUID } from "crypto";

function getPaystackSecretKey(): string {
  return process.env.PAYSTACK_SECRET_KEY ?? "";
}
function getFlutterwaveSecretKey(): string {
  return process.env.FLUTTERWAVE_SECRET_KEY ?? "";
}

export type RefundProviderState = "successful" | "failed" | "pending" | "unknown";

function mapPaystackRefundStatus(status: string | undefined): RefundProviderState {
  if (status === "processed") return "successful";
  if (status === "failed") return "failed";
  if (status === "pending") return "pending";
  return "unknown";
}

// Verified against Flutterwave's current published refund-status table
// (developer.flutterwave.com/docs/refunds — fetched directly during Phase 3B's
// Flutterwave-specific hardening pass; see the implementation report for the
// exact source). This is NOT the naive mapping it might look like:
//
//   'completed' on its own means "Refund has been initiated and is pending
//   disbursement to the customer" — i.e. still in flight, NOT a final
//   success. Only the provider-suffixed variants below represent money
//   actually having reached the customer. Treating bare 'completed' as
//   success (an earlier version of this function did) would mark a refund
//   done before Flutterwave has actually disbursed anything.
//
// No top-level "failed" status is documented for the refund object itself;
// a failure appears to surface via meta.disburse_status (seen in real
// payloads, not exhaustively documented) — checked separately by the caller
// via disburseStatus, not inferred here from `status` alone.
function mapFlutterwaveRefundStatus(status: string | undefined): RefundProviderState {
  if (
    status === "completed-bank-transfer" ||
    status === "completed-momo" ||
    status === "completed-mpgs" ||
    status === "completed-offline" ||
    status === "completed-preauth"
  ) {
    return "successful";
  }
  if (status === "completed" || status === "processing" || status === "pending-momo") {
    return "pending";
  }
  if (status === "failed") return "failed"; // not documented as a real value today, handled defensively if Flutterwave ever sends it
  return "unknown";
}

// meta.disburse_status is the one place a genuine refund failure has been
// observed to surface (real payload inspection, not the primary status
// docs) — Flutterwave's top-level `status` can apparently still read
// 'completed' (pending-disbursement) while the underlying disbursement
// attempt already failed. Checked wherever `meta` is available; absence of
// this field means "no failure signal found here," not "confirmed not
// failed" — callers should still treat an ambiguous case as 'unknown', not
// 'successful'.
function flutterwaveDisburseFailed(meta: unknown): boolean {
  if (!meta) return false;
  const parsed = typeof meta === "string" ? safeJsonParse(meta) : meta;
  if (!parsed || typeof parsed !== "object") return false;
  return (parsed as Record<string, unknown>).disburse_status === "failed";
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// Flutterwave's REST API responses (create/list/get) and its refund webhook
// payload use DIFFERENT field casing for the same data — snake_case
// (`flw_ref`, `amount_refunded`, `transaction_id`) in the REST responses,
// PascalCase-ish (`FlwRef`, `AmountRefunded`, `TransactionId`) in the raw
// webhook body. This reads either, so one normalizer covers both sources.
function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

// Purely internal — recorded in refund_events/refund_intents for Pantra's
// own audit trail and to help match a refund found via a provider search
// (fetchPaystackRefundsForTransaction / fetchFlutterwaveRefundsForTransaction)
// back to the attempt that created it. Never sent to either provider as a
// request parameter — neither refund-creation endpoint accepts one.
export function generateRefundReference(): string {
  return `PANTRA-REFUND-${randomUUID()}`;
}

export interface ProviderRefundRecord {
  providerRefundId: string;
  providerState: RefundProviderState;
  amount: number | null; // naira
  currency: string | null;
  // Flutterwave-specific identity fields (null for Paystack, which has no
  // separate reference distinct from its own refund id). Used for identity
  // -based matching instead of amount-only matching — see refund-processor.ts.
  flwRef?: string | null;
  transactionId?: string | null;
  raw: any;
}

export interface CreateRefundResult {
  ok: boolean;
  outcome: "created" | "network_error" | "rejected";
  refund: ProviderRefundRecord | null;
  httpStatus: number | null;
  message: string;
}

// --- Paystack -----------------------------------------------------------

export async function createPaystackRefund(params: {
  transactionReference: string;
  amount?: number; // naira; omit for a full refund
}): Promise<CreateRefundResult> {
  const key = getPaystackSecretKey();
  if (!key) {
    return { ok: false, outcome: "rejected", refund: null, httpStatus: null, message: "Paystack is not configured on the server." };
  }

  try {
    const body: Record<string, unknown> = { transaction: params.transactionReference };
    if (params.amount != null) body.amount = Math.round(params.amount * 100); // naira -> kobo

    const response = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();

    if (!response.ok || !result.status) {
      return { ok: false, outcome: "rejected", refund: null, httpStatus: response.status, message: result.message || "Failed to create refund." };
    }

    return {
      ok: true,
      outcome: "created",
      httpStatus: response.status,
      message: result.message ?? "",
      refund: {
        providerRefundId: String(result.data?.id ?? ""),
        providerState: mapPaystackRefundStatus(result.data?.status),
        amount: result.data?.amount != null ? Number(result.data.amount) / 100 : null,
        currency: result.data?.currency ?? null,
        raw: result,
      },
    };
  } catch (error) {
    return { ok: false, outcome: "network_error", refund: null, httpStatus: null, message: "Network error while contacting Paystack." };
  }
}

// Lists refunds Paystack has on file for the ORIGINAL transaction — the
// timeout-recovery mechanism: if our create-refund call's response was lost,
// this is how we find out whether Paystack actually created one anyway,
// without needing a provider refund id we never received.
export async function fetchPaystackRefundsForTransaction(transactionReference: string): Promise<ProviderRefundRecord[]> {
  const key = getPaystackSecretKey();
  if (!key) return [];

  try {
    const response = await fetch(`https://api.paystack.co/refund?transaction=${encodeURIComponent(transactionReference)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });
    const result = await response.json();
    if (!response.ok || !result.status || !Array.isArray(result.data)) return [];

    return result.data.map((r: any) => ({
      providerRefundId: String(r.id ?? ""),
      providerState: mapPaystackRefundStatus(r.status),
      amount: r.amount != null ? Number(r.amount) / 100 : null,
      currency: r.currency ?? null,
      raw: r,
    }));
  } catch (error) {
    return [];
  }
}

// --- Flutterwave ----------------------------------------------------------
//
// Verified against developer.flutterwave.com (fetched live during Phase 3B's
// Flutterwave-specific hardening pass):
//   - Create:      POST https://api.flutterwave.com/v3/transactions/{id}/refund
//                  body: { amount?, comments?, callbackurl? }
//                  response (snake_case): id, tx_id/transaction_id, flw_ref,
//                  amount_refunded, status, account_id, meta, created_at.
//   - Get by id:   GET https://api.flutterwave.com/v3/refunds/{id}
//                  (id = the REFUND's own id, not the original transaction).
//   - Search:      GET https://api.flutterwave.com/v3/refunds
//                  ?id=<original transaction id>&flw_ref=<ref>&status=&from=&to=
//                  — the ONLY documented way to look up a refund when its own
//                  id isn't yet known (e.g. after a create-call timeout).
//   - Refund webhooks are OFF by default on every Flutterwave account —
//     "you will need to reach out to the internal team to enable your
//     account to receive webhooks for refunds." Confirmed live from
//     Flutterwave's own refunds doc page. This is why callbackurl (below,
//     a per-request parameter needing no account-level opt-in) is used as
//     the primary asynchronous notification path, with the account-wide
//     webhook as a secondary path IF the merchant has had it enabled.

function extractFlutterwaveRefundRecord(data: Record<string, unknown>): ProviderRefundRecord {
  const status = String(pick(data, "status") ?? "");
  const meta = pick(data, "meta");
  const providerState = flutterwaveDisburseFailed(meta) ? "failed" : mapFlutterwaveRefundStatus(status);
  const amountRefunded = pick(data, "amount_refunded", "AmountRefunded");
  const amountFallback = pick(data, "amount", "Amount");
  return {
    providerRefundId: String(pick(data, "id", "Id") ?? ""),
    providerState,
    amount: amountRefunded != null ? Number(amountRefunded) : amountFallback != null ? Number(amountFallback) : null,
    currency: (pick(data, "currency", "Currency") as string | undefined) ?? null,
    flwRef: (pick(data, "flw_ref", "FlwRef") as string | undefined) ?? null,
    transactionId: pick(data, "tx_id", "transaction_id", "TransactionId") != null
      ? String(pick(data, "tx_id", "transaction_id", "TransactionId"))
      : null,
    raw: data,
  };
}

// Parses the RAW webhook body Flutterwave actually sends for a refund —
// confirmed live to be a FLAT object with no "event" wrapper at all (unlike
// charge.completed/transfer.completed, which both wrap a "data" object under
// a top-level "event" string). Example confirmed from Flutterwave's own
// reference docs:
//   { id, AmountRefunded, status, FlwRef, destination, comments,
//     settlement_id, meta, createdAt, updatedAt, deletedAt, walletId,
//     AccountId, TransactionId }
// Also accepts an { event, data } wrapper defensively, in case a specific
// account/API version does deliver it that way (the caller in
// backend/hono.ts checks for "event === 'refund.completed'" first for
// exactly this reason) — never assumed to be the primary shape, since the
// verified documentation example is flat.
export function isFlutterwaveRefundWebhookShape(payload: any): boolean {
  if (!payload || typeof payload !== "object") return false;
  const body = payload.data && typeof payload.data === "object" ? payload.data : payload;
  const hasFlwRef = pick(body, "flw_ref", "FlwRef") != null;
  const hasAmountRefunded = pick(body, "amount_refunded", "AmountRefunded") != null;
  const hasTransactionId = pick(body, "tx_id", "transaction_id", "TransactionId") != null;
  // Require at least the refund-specific reference plus one more refund-only
  // field — charge/transfer webhooks never carry flw_ref alongside
  // amount_refunded/a transaction-id-as-a-distinct-field, so this shape is
  // not expected to collide with the existing charge/transfer dispatch.
  return hasFlwRef && (hasAmountRefunded || hasTransactionId);
}

export function parseFlutterwaveRefundWebhookPayload(payload: any): ProviderRefundRecord {
  const body = payload.data && typeof payload.data === "object" ? payload.data : payload;
  return extractFlutterwaveRefundRecord(body);
}

export async function createFlutterwaveRefund(params: {
  transactionId: string; // Flutterwave's OWN transaction id, not our reference
  amount?: number; // naira; omit for a full refund
  callbackUrl?: string;
}): Promise<CreateRefundResult> {
  const key = getFlutterwaveSecretKey();
  if (!key) {
    return { ok: false, outcome: "rejected", refund: null, httpStatus: null, message: "Flutterwave is not configured on the server." };
  }

  try {
    const body: Record<string, unknown> = {};
    if (params.amount != null) body.amount = params.amount; // Flutterwave refund amounts are major-unit (naira), not kobo
    if (params.callbackUrl) body.callbackurl = params.callbackUrl;

    const response = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(params.transactionId)}/refund`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();

    if (result.status !== "success" || !result.data) {
      // Verified live against a real (test-mode) Flutterwave account: on a
      // rejection, the actually useful diagnostic lives in `data` (a plain
      // string, e.g. "Error: Cannot refund non-existent/unauthorized
      // transaction"), NOT in `message` (which is a generic "Some error
      // occured" regardless of the real cause). An earlier version of this
      // function only surfaced `message`, leaving an admin with no way to
      // tell WHY a refund was rejected from the failureReason alone.
      const detail = typeof result.data === "string" && result.data ? result.data : null;
      return {
        ok: false,
        outcome: "rejected",
        refund: null,
        httpStatus: response.status,
        message: detail ?? result.message ?? "Failed to create refund.",
      };
    }

    return {
      ok: true,
      outcome: "created",
      httpStatus: response.status,
      message: result.message ?? "",
      refund: extractFlutterwaveRefundRecord(result.data),
    };
  } catch (error) {
    return { ok: false, outcome: "network_error", refund: null, httpStatus: null, message: "Network error while contacting Flutterwave." };
  }
}

// Identity-based lookup by the refund's OWN id — the PRIMARY verification
// path once a providerRefundId is known (the normal case after a successful
// create-call, or once discovered from a webhook/callback). Never falls
// back to amount matching itself; that only happens one level up, in
// fetchFlutterwaveRefundsForOriginalTransaction, and only when no id is
// known at all.
export async function fetchFlutterwaveRefundById(refundId: string): Promise<ProviderRefundRecord | null> {
  const key = getFlutterwaveSecretKey();
  if (!key) return null;

  try {
    const response = await fetch(`https://api.flutterwave.com/v3/refunds/${encodeURIComponent(refundId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });
    const result = await response.json();
    if (result.status !== "success" || !result.data) return null;
    return extractFlutterwaveRefundRecord(result.data);
  } catch (error) {
    return null;
  }
}

// The timeout-recovery path when no providerRefundId is known yet: search by
// the ORIGINAL transaction id via GET /v3/refunds?id=<transactionId>
// (confirmed live — the query param is literally named "id" but filters by
// the transaction, not the refund itself; distinct from GET /v3/refunds/{id}
// above, which looks up one refund by ITS OWN id). Returns every refund
// Flutterwave has on file for that transaction — matching a specific one
// among the results (by flw_ref if known, else amount, else "ambiguous, do
// nothing") is the caller's job, per refund-processor.ts.
export async function fetchFlutterwaveRefundsForTransaction(transactionId: string): Promise<ProviderRefundRecord[]> {
  const key = getFlutterwaveSecretKey();
  if (!key) return [];

  try {
    const response = await fetch(`https://api.flutterwave.com/v3/refunds?id=${encodeURIComponent(transactionId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });
    const result = await response.json();
    if (result.status !== "success" || !Array.isArray(result.data)) return [];

    return result.data.map((r: any) => extractFlutterwaveRefundRecord(r));
  } catch (error) {
    return [];
  }
}
