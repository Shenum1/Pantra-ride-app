import { createHmac, timingSafeEqual } from "crypto";

// Read lazily (not as module-level constants) so tests can set/unset these
// per-case without needing to control import order — same fix already
// applied to backend/lib/directions-service.ts and bank-account-crypto.ts.
function getPaystackSecretKey(): string {
  return process.env.PAYSTACK_SECRET_KEY ?? "";
}
function getFlutterwaveWebhookSecretHash(): string {
  return process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH ?? "";
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch rather than returning false —
  // guard explicitly so a shorter/longer forged header doesn't crash the
  // request handler (which would otherwise leak timing information anyway
  // via the exception path, defeating the point).
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Paystack's mechanism: HMAC-SHA512 of the EXACT raw request body, keyed
// with the secret key, hex-encoded, sent as x-paystack-signature. Must be
// computed over the raw bytes/string — never a JSON.parse'd-and-re-
// stringified version, which is not guaranteed to be byte-identical.
export function verifyPaystackSignature(rawBody: string, signatureHeader: string | null | undefined): boolean {
  const secretKey = getPaystackSecretKey();
  if (!secretKey || !signatureHeader) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody, "utf8").digest("hex");
  return constantTimeEqual(expected, signatureHeader);
}

// Flutterwave's mechanism is NOT an HMAC over the body — it's a static
// shared secret you configure once in their dashboard, which they echo back
// verbatim in every webhook's verif-hash header. Verification is just a
// constant-time string comparison against that configured value.
export function verifyFlutterwaveSignature(hashHeader: string | null | undefined): boolean {
  const configuredHash = getFlutterwaveWebhookSecretHash();
  if (!configuredHash || !hashHeader) return false;
  return constantTimeEqual(configuredHash, hashHeader);
}
