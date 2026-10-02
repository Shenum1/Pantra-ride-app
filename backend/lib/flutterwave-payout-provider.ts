// Flutterwave Transfers API wrapper — the payout-side counterpart to
// backend/lib/payout-provider.ts (Paystack). Kept as a separate file for the
// same reason payout-provider.ts is separate from payment-providers.ts: a
// different API surface (/v3/transfers, /v3/accounts/resolve) with its own
// response shapes. Mirrors payout-provider.ts's function shapes and outcome
// taxonomy exactly so backend/lib/payout-processor.ts can dispatch between
// the two providers structurally identically.
//
// Verified live against developer.flutterwave.com during planning (not
// assumed) — see the implementation plan for citations. Two things that do
// NOT match a naive Paystack-shaped assumption, same lesson as the refund
// webhook hardening pass:
//   1. Flutterwave has no persistent "recipient" object — a transfer takes
//      account_bank + account_number directly on every call. There is no
//      equivalent of Paystack's /transferrecipient step to cache a code for.
//   2. GET /v3/transfers/{id} looks up by FLUTTERWAVE'S OWN id, never by
//      Pantra's own reference — unlike Paystack's GET /transfer/:reference.
//      This means reconciliation needs providerTransferCode (captured from
//      the create-transfer response), not providerTransferReference.

import { PayoutProviderState } from "./payout-provider";

function getFlutterwaveSecretKey(): string {
  return process.env.FLUTTERWAVE_SECRET_KEY ?? "";
}

// Confirmed live: NEW (on creation), SUCCESSFUL (via get-transfer example).
// PENDING/FAILED are inferred from the documented webhook payload, not
// independently seen on a creation/get-transfer response — mapped
// defensively, never assumed complete. No FLUTTERWAVE "reversed" status is
// documented for transfers at all (unlike Paystack); this mapper simply
// never produces PayoutProviderState's "reversed" value, which is fine.
export function mapFlutterwaveTransferStatus(status: string | undefined): PayoutProviderState {
  if (status === "SUCCESSFUL") return "successful";
  if (status === "FAILED") return "failed";
  if (status === "NEW" || status === "PENDING") return "pending";
  return "unknown";
}

export interface ResolveAccountResult {
  ok: boolean;
  resolvedAccountName: string | null;
  message: string;
  raw: any;
}

// Flutterwave's equivalent of Paystack's recipient-creation verification
// step — confirms a bank_code + account_number pair actually resolves to a
// real account before a transfer is attempted. Unlike Paystack, nothing
// here is persisted as a reusable "recipient code"; this is pure
// verification, called again on every bank account add / first-payout
// attempt (cheap, no account-level state to go stale).
export async function resolveFlutterwaveAccountName(params: {
  accountNumber: string;
  bankCode: string;
}): Promise<ResolveAccountResult> {
  const key = getFlutterwaveSecretKey();
  if (!key) {
    return { ok: false, resolvedAccountName: null, message: "Flutterwave is not configured on the server.", raw: null };
  }

  try {
    const response = await fetch("https://api.flutterwave.com/v3/accounts/resolve", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ account_number: params.accountNumber, account_bank: params.bankCode }),
    });

    const result = await response.json();

    if (!response.ok || result.status !== "success" || !result.data) {
      return {
        ok: false,
        resolvedAccountName: null,
        message: result.message || "Failed to resolve bank account.",
        raw: result,
      };
    }

    return {
      ok: true,
      resolvedAccountName: result.data?.account_name ?? null,
      message: result.message ?? "",
      raw: result,
    };
  } catch (error) {
    return { ok: false, resolvedAccountName: null, message: "Network error while contacting Flutterwave.", raw: null };
  }
}

export interface InitiateTransferResult {
  ok: boolean;
  // 'duplicate_reference': Flutterwave rejects a reused reference outright
  // (confirmed via their bulk-transfer docs: "Payout with this ref already
  // exists.") — reject-on-duplicate, not a cached-replay like Paystack. The
  // exact single-transfer rejection message was NOT independently confirmed
  // during planning; this match is intentionally broad and should be
  // tightened against a real sandbox duplicate-reference call before this
  // is trusted in production, same as the createFlutterwaveRefund
  // error-message fix elsewhere in this codebase.
  outcome: "created" | "duplicate_reference" | "network_error" | "rejected";
  providerTransferCode: string | null; // Flutterwave's own transfer id — required for later verification
  providerState: PayoutProviderState;
  httpStatus: number | null;
  message: string;
  raw: any;
}

export async function initiateFlutterwaveTransfer(params: {
  amount: number; // naira — Flutterwave takes the base currency unit directly, no kobo-style conversion
  accountNumber: string;
  bankCode: string;
  reference: string;
  narration?: string;
}): Promise<InitiateTransferResult> {
  const key = getFlutterwaveSecretKey();
  if (!key) {
    return {
      ok: false,
      outcome: "rejected",
      providerTransferCode: null,
      providerState: "unknown",
      httpStatus: null,
      message: "Flutterwave is not configured on the server.",
      raw: null,
    };
  }

  try {
    const response = await fetch("https://api.flutterwave.com/v3/transfers", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        account_bank: params.bankCode,
        account_number: params.accountNumber,
        amount: params.amount,
        currency: "NGN",
        reference: params.reference,
        narration: params.narration ?? "Pantra driver payout",
      }),
    });

    const result = await response.json();

    if (!response.ok || result.status !== "success" || !result.data) {
      const isDuplicate = typeof result.message === "string" && /already exists|duplicate/i.test(result.message);
      return {
        ok: false,
        outcome: isDuplicate ? "duplicate_reference" : "rejected",
        providerTransferCode: null,
        providerState: "unknown",
        httpStatus: response.status,
        message: result.message || "Failed to initiate transfer.",
        raw: result,
      };
    }

    return {
      ok: true,
      outcome: "created",
      providerTransferCode: result.data?.id != null ? String(result.data.id) : null,
      providerState: mapFlutterwaveTransferStatus(result.data?.status),
      httpStatus: response.status,
      message: result.message ?? "",
      raw: result,
    };
  } catch (error) {
    // Genuinely unknown whether Flutterwave received this request — callers
    // must verify (once a providerTransferCode exists) rather than assume
    // or retry blindly, same rule as the Paystack side.
    return {
      ok: false,
      outcome: "network_error",
      providerTransferCode: null,
      providerState: "unknown",
      httpStatus: null,
      message: "Network error while contacting Flutterwave.",
      raw: null,
    };
  }
}

export interface VerifyTransferResult {
  found: boolean;
  providerState: PayoutProviderState;
  amount: number | null; // naira
  providerTransferCode: string | null;
  // The merchant reference Flutterwave has on file for this transfer —
  // callers must check it equals the payout's own providerTransferReference
  // before applying the outcome, since the id being looked up may have come
  // from an (unsigned-by-HMAC) webhook payload rather than our own create call.
  reference: string | null;
  message: string;
  raw: any;
}

// Looks up by FLUTTERWAVE'S OWN id (providerTransferCode), never by Pantra's
// reference — no by-reference lookup endpoint for transfers is confirmed to
// exist. If a transfer's id was never captured (e.g. a network_error on
// creation before the response came back), this function cannot be called
// meaningfully at all — callers must treat a missing providerTransferCode as
// "needs manual review," not retry this with the reference instead.
export async function verifyFlutterwaveTransfer(providerTransferCode: string): Promise<VerifyTransferResult> {
  const key = getFlutterwaveSecretKey();
  if (!key) {
    return { found: false, providerState: "unknown", amount: null, providerTransferCode: null, reference: null, message: "Flutterwave is not configured on the server.", raw: null };
  }

  try {
    const response = await fetch(`https://api.flutterwave.com/v3/transfers/${encodeURIComponent(providerTransferCode)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });

    const result = await response.json();

    if (!response.ok || result.status !== "success" || !result.data) {
      return {
        found: false,
        providerState: "unknown",
        amount: null,
        providerTransferCode: null,
        reference: null,
        message: result.message || "Transfer not found.",
        raw: result,
      };
    }

    return {
      found: true,
      providerState: mapFlutterwaveTransferStatus(result.data?.status),
      amount: result.data?.amount != null ? Number(result.data.amount) : null,
      providerTransferCode: result.data?.id != null ? String(result.data.id) : null,
      reference: typeof result.data?.reference === "string" ? result.data.reference : null,
      message: result.message ?? "",
      raw: result,
    };
  } catch (error) {
    return { found: false, providerState: "unknown", amount: null, providerTransferCode: null, reference: null, message: "Network error while contacting Flutterwave.", raw: null };
  }
}
