// Shared, server-side payment-provider verification. Both the public
// payments.{paystack,flutterwave}.verify routes and the authed
// payments.wallet.credit route call these — the verification logic (and its
// correctness) lives in exactly one place, never duplicated per caller.

import { randomUUID } from "crypto";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY ?? "";
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY ?? "";

// Normalized provider outcome, distinct from the coarse `success` boolean:
// - 'successful': provider confirms the charge succeeded.
// - 'failed': provider EXPLICITLY confirms the charge failed/was abandoned/
//   reversed — a final, non-retryable outcome.
// - 'pending': provider says the charge is still processing.
// - 'unknown': provider status can't currently be determined (network error,
//   malformed response, or a status value we don't recognize) — NOT the same
//   as 'failed'. Callers must treat this as retryable, never as a permanent
//   rejection (see backend/lib/payment-processor.ts).
export type ProviderState = "successful" | "failed" | "pending" | "unknown";

export interface VerifiedPayment {
  success: boolean;
  providerState: ProviderState;
  // The amount the provider confirms was actually charged, in Naira — null
  // whenever success is false. Callers must use THIS amount, never a
  // client-supplied one, when crediting anything.
  amount: number | null;
  currency: string | null;
  message: string;
  raw: any;
}

// Both providers use PANTRA-<uuid> as their reference/tx_ref going forward —
// a single scheme instead of a provider-specific prefix, generated
// server-side (never client-supplied) so a rider can never choose or predict
// their own payment reference. Old FLW-/TXN- prefixed references from before
// this change keep verifying fine (verifyFlutterwaveTransaction already
// checks for a "PANTRA-" prefix — this is what finally exercises that
// branch).
export function generatePaymentReference(): string {
  return `PANTRA-${randomUUID()}`;
}

function paystackProviderState(status: string | undefined): ProviderState {
  if (status === "success") return "successful";
  if (status === "failed" || status === "abandoned" || status === "reversed") return "failed";
  if (status === "pending" || status === "queued" || status === "ongoing") return "pending";
  return "unknown";
}

function flutterwaveProviderState(status: string | undefined): ProviderState {
  if (status === "successful") return "successful";
  if (status === "failed") return "failed";
  if (status === "pending") return "pending";
  return "unknown";
}

export async function verifyPaystackTransaction(reference: string): Promise<VerifiedPayment> {
  if (!PAYSTACK_SECRET_KEY) {
    console.warn("⚠️ PAYSTACK_SECRET_KEY is not configured on the server");
    return {
      success: false,
      providerState: "unknown",
      amount: null,
      currency: null,
      message: "Paystack is not configured. Please add PAYSTACK_SECRET_KEY to the server environment.",
      raw: null,
    };
  }

  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      }
    );

    const result = await response.json();

    if (!response.ok || !result.status) {
      console.error("Paystack verification failed:", result);
      return {
        success: false,
        providerState: "unknown",
        amount: null,
        currency: null,
        message: result.message || "Failed to verify payment",
        raw: result,
      };
    }

    const providerState = paystackProviderState(result.data?.status);
    const success = providerState === "successful";
    return {
      success,
      providerState,
      // Paystack reports amount in kobo.
      amount: success ? Number(result.data?.amount ?? 0) / 100 : null,
      currency: result.data?.currency ?? null,
      message: result.message ?? "",
      raw: result,
    };
  } catch (error) {
    console.error("Error verifying Paystack transaction:", error);
    return {
      success: false,
      providerState: "unknown",
      amount: null,
      currency: null,
      message: "Network error while contacting Paystack.",
      raw: null,
    };
  }
}

export async function verifyFlutterwaveTransaction(transactionIdOrReference: string): Promise<VerifiedPayment> {
  if (!FLUTTERWAVE_SECRET_KEY) {
    console.warn("⚠️ FLUTTERWAVE_SECRET_KEY is not configured on the server");
    return {
      success: false,
      providerState: "unknown",
      amount: null,
      currency: null,
      message: "Flutterwave is not configured. Please add FLUTTERWAVE_SECRET_KEY to the server environment.",
      raw: null,
    };
  }

  const isReference = transactionIdOrReference.startsWith("FLW-") || transactionIdOrReference.startsWith("PANTRA-");
  const verifyUrl = isReference
    ? `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(transactionIdOrReference)}`
    : `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionIdOrReference)}/verify`;

  try {
    const response = await fetch(verifyUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}` },
    });

    const result = await response.json();

    if (result.status !== "success") {
      console.error("Flutterwave verification failed:", result);
      return {
        success: false,
        providerState: "unknown",
        amount: null,
        currency: null,
        message: result.message || "Failed to verify payment",
        raw: result,
      };
    }

    // `result.status === "success"` only means the API CALL itself
    // succeeded — it is returned even when the underlying charge failed.
    // `result.data.status` is the actual transaction outcome and is what
    // must gate whether this payment is treated as real.
    const providerState = flutterwaveProviderState(result.data?.status);
    const success = providerState === "successful";
    return {
      success,
      providerState,
      amount: success ? Number(result.data?.amount ?? 0) : null,
      currency: result.data?.currency ?? null,
      message: result.message ?? "",
      raw: result,
    };
  } catch (error) {
    console.error("Error verifying Flutterwave transaction:", error);
    return {
      success: false,
      providerState: "unknown",
      amount: null,
      currency: null,
      message: "Network error while contacting Flutterwave.",
      raw: null,
    };
  }
}
