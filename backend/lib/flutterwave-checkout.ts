// Creates a Flutterwave hosted checkout for money coming INTO Pantra — a
// rider's wallet top-up or a driver paying their cash commission. One
// implementation for both, so every checkout gets the same payment_intents
// record (which the webhook and the app's own confirmation both verify
// against — see backend/lib/payment-processor.ts) and the same return-URL
// rules.

import { SupabaseClient } from "@supabase/supabase-js";
import { generatePaymentReference } from "./payment-providers";

export type CheckoutPurpose = "wallet_funding" | "commission_settlement";

const DEFAULT_CHECKOUT_RETURN_URL = "https://pantraride.space/payment-callback";

// Where Flutterwave sends the user once checkout finishes. The app asks for
// its own link (pantra:// in builds, exp:// in Expo Go) so the in-app
// checkout sheet can close itself and return control to the app; the web
// app asks for its own /payment-callback page. Anything else falls back to
// the production web callback — the client never gets to point a Pantra
// checkout at an arbitrary site.
export function resolveCheckoutReturnUrl(candidate: string | undefined): string {
  if (!candidate) return DEFAULT_CHECKOUT_RETURN_URL;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return DEFAULT_CHECKOUT_RETURN_URL;
  }
  if (url.protocol === "pantra:" || url.protocol === "exp:" || url.protocol === "exps:") return candidate;

  const allowedHttpsHosts = new Set(["pantraride.space", "www.pantraride.space"]);
  const configuredBase = process.env.PANTRA_API_BASE_URL;
  if (configuredBase) {
    try {
      allowedHttpsHosts.add(new URL(configuredBase).hostname);
    } catch {
      // ignore a malformed base URL — the fixed hosts above still apply
    }
  }
  if (url.protocol === "https:" && allowedHttpsHosts.has(url.hostname)) return candidate;
  if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) return candidate;

  return DEFAULT_CHECKOUT_RETURN_URL;
}

export type CreateCheckoutResult =
  | { status: "success"; message: string; data: { link: string; tx_ref: string; amount: number } }
  | { status: "error"; message: string };

export async function createFlutterwaveCheckout(params: {
  supabaseAdmin: SupabaseClient;
  userId: string;
  purpose: CheckoutPurpose;
  amount: number; // naira, already validated by the caller
  customer: { email: string; name?: string; phone?: string };
  returnUrl?: string;
  title: string;
  description: string;
  meta?: Record<string, unknown>;
}): Promise<CreateCheckoutResult> {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY ?? "";
  if (!secretKey) {
    console.warn("FLUTTERWAVE_SECRET_KEY is not configured on the server");
    return { status: "error", message: "Flutterwave is not configured. Please add FLUTTERWAVE_SECRET_KEY to the server environment." };
  }

  // Generated server-side, never client-supplied.
  const tx_ref = generatePaymentReference();

  const { error: intentError } = await params.supabaseAdmin.from("payment_intents").insert({
    userId: params.userId,
    provider: "flutterwave",
    reference: tx_ref,
    purpose: params.purpose,
    expectedAmount: params.amount,
    currency: "NGN",
    status: "initialized",
  });
  if (intentError) {
    console.error("Failed to create payment intent:", intentError);
    return { status: "error", message: "Could not start this payment. Please try again." };
  }

  try {
    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref,
        amount: params.amount,
        currency: "NGN",
        redirect_url: resolveCheckoutReturnUrl(params.returnUrl),
        payment_options: "card,banktransfer,ussd,mobilemoney",
        customer: {
          email: params.customer.email,
          phonenumber: params.customer.phone,
          name: params.customer.name || "Customer",
        },
        // Shown at the top of Flutterwave's checkout page.
        customizations: { title: params.title, description: params.description },
        meta: params.meta,
      }),
    });

    const result = await response.json();

    if (result.status !== "success" || typeof result.data?.link !== "string") {
      console.error("Flutterwave initialization failed:", result);
      await params.supabaseAdmin.from("payment_intents").update({ status: "cancelled" }).eq("reference", tx_ref);
      return { status: "error", message: result.message || "Failed to initialize payment" };
    }

    // Flutterwave's response carries only { link } (verified against the
    // sandbox) — never the tx_ref. The app needs our reference to confirm
    // the payment afterwards, so it's returned here explicitly.
    return {
      status: "success",
      message: "Payment initialized successfully",
      data: { link: result.data.link, tx_ref, amount: params.amount },
    };
  } catch (error) {
    console.error("Error initializing Flutterwave payment:", error);
    await params.supabaseAdmin.from("payment_intents").update({ status: "cancelled" }).eq("reference", tx_ref);
    return { status: "error", message: "Network error while contacting Flutterwave." };
  }
}
