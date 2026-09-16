// Paystack Transfer API wrapper — the payout-side counterpart to
// backend/lib/payment-providers.ts. Kept as a separate file rather than
// added to payment-providers.ts because it speaks a different Paystack API
// surface entirely (transferrecipient/transfer, not
// transaction/verify) with its own response shapes; nothing here duplicates
// or modifies the existing charge-verification logic.
//
// Paystack only, per the Phase 3A provider decision (see the implementation
// report) — Flutterwave remains wired up for wallet top-ups and is
// untouched by this file.

import { randomUUID } from "crypto";

// Lazy read (not a module-level constant) so tests can set/unset this
// per-case without controlling import order — same fix already applied to
// backend/lib/webhook-signatures.ts and backend/lib/directions-service.ts.
function getPaystackSecretKey(): string {
  return process.env.PAYSTACK_SECRET_KEY ?? "";
}

export type PayoutProviderState = "successful" | "failed" | "pending" | "reversed" | "unknown";

function mapPaystackTransferStatus(status: string | undefined): PayoutProviderState {
  if (status === "success") return "successful";
  if (status === "failed") return "failed";
  if (status === "reversed") return "reversed";
  // 'otp' — Paystack's default OTP-finalization step for API-initiated
  // transfers unless "Disable OTP" has been granted for the integration
  // (an account-level setting, not something this code can change). Treated
  // as pending: safe (never marks the payout completed/failed), but a
  // transfer stuck here forever is exactly the "requires Paystack dashboard
  // configuration" limitation documented in the implementation report.
  if (status === "pending" || status === "otp" || status === "processing" || status === "queued") return "pending";
  return "unknown";
}

export function generatePayoutReference(): string {
  return `PANTRA-PAYOUT-${randomUUID()}`;
}

export interface CreateRecipientResult {
  ok: boolean;
  recipientCode: string | null;
  resolvedAccountName: string | null;
  message: string;
  raw: any;
}

export async function createPaystackTransferRecipient(params: {
  accountNumber: string;
  bankCode: string;
  accountName: string;
}): Promise<CreateRecipientResult> {
  const key = getPaystackSecretKey();
  if (!key) {
    return { ok: false, recipientCode: null, resolvedAccountName: null, message: "Paystack is not configured on the server.", raw: null };
  }

  try {
    const response = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "nuban",
        name: params.accountName,
        account_number: params.accountNumber,
        bank_code: params.bankCode,
        currency: "NGN",
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.status) {
      return {
        ok: false,
        recipientCode: null,
        resolvedAccountName: null,
        message: result.message || "Failed to create transfer recipient.",
        raw: result,
      };
    }

    return {
      ok: true,
      recipientCode: result.data?.recipient_code ?? null,
      resolvedAccountName: result.data?.details?.account_name ?? null,
      message: result.message ?? "",
      raw: result,
    };
  } catch (error) {
    return {
      ok: false,
      recipientCode: null,
      resolvedAccountName: null,
      message: "Network error while contacting Paystack.",
      raw: null,
    };
  }
}

export interface InitiateTransferResult {
  ok: boolean;
  // 'duplicate_reference': Paystack itself rejected this reference as
  // already used — the strongest available signal that a PRIOR attempt for
  // this exact payout already reached Paystack, even if Pantra never
  // recorded a clean response for it (e.g. a timeout). Callers must treat
  // this as "go look up the real state," never as "safe to try again with a
  // new reference."
  outcome: "created" | "duplicate_reference" | "network_error" | "rejected";
  providerTransferCode: string | null;
  providerState: PayoutProviderState;
  httpStatus: number | null;
  message: string;
  raw: any;
}

export async function initiatePaystackTransfer(params: {
  amount: number; // naira
  recipientCode: string;
  reference: string;
  reason?: string;
}): Promise<InitiateTransferResult> {
  const key = getPaystackSecretKey();
  if (!key) {
    return {
      ok: false,
      outcome: "rejected",
      providerTransferCode: null,
      providerState: "unknown",
      httpStatus: null,
      message: "Paystack is not configured on the server.",
      raw: null,
    };
  }

  try {
    const response = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "balance",
        amount: Math.round(params.amount * 100), // naira -> kobo
        recipient: params.recipientCode,
        reference: params.reference,
        reason: params.reason ?? "Pantra driver payout",
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.status) {
      const isDuplicate = typeof result.message === "string" && /duplicate/i.test(result.message);
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
      providerTransferCode: result.data?.transfer_code ?? null,
      providerState: mapPaystackTransferStatus(result.data?.status),
      httpStatus: response.status,
      message: result.message ?? "",
      raw: result,
    };
  } catch (error) {
    // A network exception here is exactly the "provider timeout / response
    // lost" case in the spec — we genuinely do not know whether Paystack
    // received and processed this request. Callers must verify via
    // verifyPaystackTransfer before drawing any conclusion, never assume
    // failure and never blindly retry.
    return {
      ok: false,
      outcome: "network_error",
      providerTransferCode: null,
      providerState: "unknown",
      httpStatus: null,
      message: "Network error while contacting Paystack.",
      raw: null,
    };
  }
}

export interface VerifyTransferResult {
  found: boolean;
  providerState: PayoutProviderState;
  amount: number | null; // naira
  providerTransferCode: string | null;
  message: string;
  raw: any;
}

export async function verifyPaystackTransfer(reference: string): Promise<VerifyTransferResult> {
  const key = getPaystackSecretKey();
  if (!key) {
    return { found: false, providerState: "unknown", amount: null, providerTransferCode: null, message: "Paystack is not configured on the server.", raw: null };
  }

  try {
    const response = await fetch(`https://api.paystack.co/transfer/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });

    const result = await response.json();

    if (!response.ok || !result.status || !result.data) {
      return {
        found: false,
        providerState: "unknown",
        amount: null,
        providerTransferCode: null,
        message: result.message || "Transfer not found.",
        raw: result,
      };
    }

    return {
      found: true,
      providerState: mapPaystackTransferStatus(result.data?.status),
      amount: result.data?.amount != null ? Number(result.data.amount) / 100 : null,
      providerTransferCode: result.data?.transfer_code ?? null,
      message: result.message ?? "",
      raw: result,
    };
  } catch (error) {
    return {
      found: false,
      providerState: "unknown",
      amount: null,
      providerTransferCode: null,
      message: "Network error while contacting Paystack.",
      raw: null,
    };
  }
}
