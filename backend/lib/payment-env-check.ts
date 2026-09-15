// Warning-only environment consistency check — this codebase has no
// existing hard environment gate to hook a failure into, and a
// false-positive boot failure would be worse than a missed warning. Called
// once at server startup (backend/hono.ts module load).
export function checkPaymentEnvironmentConsistency(): void {
  if (process.env.NODE_ENV !== "production") return;

  const paystackKey = process.env.PAYSTACK_SECRET_KEY ?? "";
  const flutterwaveKey = process.env.FLUTTERWAVE_SECRET_KEY ?? "";

  if (paystackKey.startsWith("sk_test_")) {
    console.error(
      "⚠️ PAYSTACK_SECRET_KEY looks like a TEST key (sk_test_...) but NODE_ENV=production. " +
        "Live payments will be processed against Paystack's test environment."
    );
  }

  if (flutterwaveKey.startsWith("FLWSECK_TEST")) {
    console.error(
      "⚠️ FLUTTERWAVE_SECRET_KEY looks like a TEST key (FLWSECK_TEST...) but NODE_ENV=production. " +
        "Live payments will be processed against Flutterwave's test environment."
    );
  }
}
