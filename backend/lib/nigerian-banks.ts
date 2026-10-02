// Static bank-code table used to resolve a driver's free-text bank name
// (app/driver-add-bank.tsx has always collected this as plain text, e.g.
// "GTBank" — changing that screen to a bank picker is out of scope) into the
// bank code a payout provider's transfer API requires. Server-only — never
// imported by client-bundled code.
//
// BANK_ALIASES holds PAYSTACK's codes. These are NOT universal: checked live
// against Flutterwave's GET /v3/banks/NG (sandbox, 2026-10-02), the 22
// traditional commercial-bank codes match exactly, but every fintech/MFB code
// here differs on Flutterwave — and Paystack's Taj Bank code (302) is a
// DIFFERENT bank (Eartholeum) on Flutterwave. Always resolve with the
// provider that will actually receive the code; never reuse a code resolved
// for one provider with the other.
//
// If a name can't be resolved, automatic payout initiation falls back to
// manual_review rather than guessing at a code (see
// backend/lib/payout-processor.ts) — this table intentionally only ever
// returns a confident match or null.
const BANK_ALIASES: Record<string, string> = {
  "access bank": "044",
  "access": "044",
  "diamond bank": "044", // merged into Access Bank
  "gtbank": "058",
  "guaranty trust bank": "058",
  "gt bank": "058",
  "guaranty trust": "058",
  "zenith bank": "057",
  "zenith": "057",
  "first bank": "011",
  "first bank of nigeria": "011",
  "firstbank": "011",
  "uba": "033",
  "united bank for africa": "033",
  "union bank": "032",
  "fidelity bank": "070",
  "fidelity": "070",
  "ecobank": "050",
  "ecobank nigeria": "050",
  "sterling bank": "232",
  "sterling": "232",
  "stanbic ibtc": "221",
  "stanbic ibtc bank": "221",
  "stanbic": "221",
  "wema bank": "035",
  "wema": "035",
  "alat by wema": "035",
  "polaris bank": "076",
  "polaris": "076",
  "keystone bank": "082",
  "keystone": "082",
  "heritage bank": "030",
  "heritage": "030",
  "unity bank": "215",
  "unity": "215",
  "providus bank": "101",
  "providus": "101",
  "suntrust bank": "100",
  "suntrust": "100",
  "titan trust bank": "102",
  "titan trust": "102",
  "globus bank": "00103",
  "globus": "00103",
  "jaiz bank": "301",
  "jaiz": "301",
  "taj bank": "302",
  "kuda": "50211",
  "kuda bank": "50211",
  "kuda microfinance bank": "50211",
  "opay": "999992",
  "opay digital services": "999992",
  "palmpay": "999991",
  "moniepoint": "50515",
  "moniepoint mfb": "50515",
  "moniepoint microfinance bank": "50515",
  "vfd microfinance bank": "566",
  "vfd": "566",
  "standard chartered bank": "068",
  "standard chartered": "068",
  "citibank": "023",
  "citibank nigeria": "023",
  "fcmb": "214",
  "first city monument bank": "214",
};

// Paystack code -> Flutterwave code, for exactly the banks whose codes
// differ (each verified by name in Flutterwave's live /v3/banks/NG list).
// OPay also appears there under its old name "Paycom" (305); 100004 is the
// entry Flutterwave labels "Opay". A wrong code here is not silently
// dangerous: Flutterwave account resolution / transfer validation rejects a
// bank+account pair that doesn't exist, which lands the payout in
// manual_review rather than sending money anywhere.
const FLUTTERWAVE_CODE_OVERRIDES: Record<string, string> = {
  "50211": "090267", // Kuda
  "999992": "100004", // OPay
  "999991": "100033", // PalmPay
  "50515": "090405", // Moniepoint Microfinance Bank
  "566": "090110", // VFD Microfinance Bank
  "00103": "103", // Globus Bank
  "102": "000025", // Titan Trust Bank
  "302": "000026", // Taj Bank (302 is Eartholeum on Flutterwave)
};

function normalize(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\bplc\b|\blimited\b|\bltd\b|\bnigeria\b|\bmfb\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolvePaystackBankCode(bankName: string): string | null {
  if (!bankName) return null;
  const normalized = normalize(bankName);
  if (!normalized) return null;

  const exact = BANK_ALIASES[normalized];
  if (exact) return exact;

  // Substring fallback for partial/loose typing (e.g. "Zenith" already
  // matches directly above; this also catches "Zenith Bank Plc Nigeria"
  // style variants after normalization didn't produce an exact key match).
  for (const [alias, code] of Object.entries(BANK_ALIASES)) {
    if (normalized.includes(alias) || alias.includes(normalized)) return code;
  }
  return null;
}

export function resolveBankCode(bankName: string, provider: "paystack" | "flutterwave" = "paystack"): string | null {
  const code = resolvePaystackBankCode(bankName);
  if (!code || provider === "paystack") return code;
  return FLUTTERWAVE_CODE_OVERRIDES[code] ?? code;
}
