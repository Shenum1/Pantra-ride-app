// Cash-ride commission debt: how much a driver owes Pantra, whether that
// blocks them from cash rides, and recording a payment against it. The
// numbers come from the database functions in
// database/schemas/supabase-schema-cash-commission-ledger.sql and
// supabase-schema-cash-commission-settlement.sql, so the app and the
// database-level accept check always agree.

import { SupabaseClient } from "@supabase/supabase-js";

export interface CashCommissionStatus {
  // earnings + tips + commission ledger − payouts. Negative = owes Pantra.
  netBalance: number;
  amountOwed: number;
  limit: number;
  // Owes MORE than the limit — cash rides are hidden and can't be accepted.
  blocked: boolean;
}

export function cashCommissionStatusFrom(netBalance: number, limit: number): CashCommissionStatus {
  const amountOwed = netBalance < 0 ? Math.round(-netBalance * 100) / 100 : 0;
  return { netBalance, amountOwed, limit, blocked: netBalance < -limit };
}

export async function getCashCommissionStatus(supabaseAdmin: SupabaseClient, driverId: string): Promise<CashCommissionStatus> {
  const [balanceRes, limitRes] = await Promise.all([
    supabaseAdmin.rpc("get_driver_net_balance", { driver_id: driverId }),
    supabaseAdmin.rpc("get_driver_cash_debt_limit"),
  ]);
  if (balanceRes.error) throw new Error(`Could not read driver balance: ${balanceRes.error.message}`);
  if (limitRes.error) throw new Error(`Could not read cash debt limit: ${limitRes.error.message}`);
  return cashCommissionStatusFrom(Number(balanceRes.data ?? 0), Number(limitRes.data ?? 0));
}

// Records a payment against a driver's commission debt. Idempotent on
// `reference` (unique for settlements — see the migration): recording the
// same payment twice, e.g. a Flutterwave webhook racing the app's own
// confirmation, returns { recorded: false } instead of crediting twice.
export async function recordCommissionSettlement(
  supabaseAdmin: SupabaseClient,
  params: { driverId: string; amount: number; reference: string; reason: string; createdBy?: string | null }
): Promise<{ recorded: boolean }> {
  const { error } = await supabaseAdmin.from("driver_commission_ledger").insert({
    driverId: params.driverId,
    type: "cash_commission_settlement",
    amount: params.amount,
    reference: params.reference,
    reason: params.reason,
    createdBy: params.createdBy ?? null,
  });
  if (error) {
    if (error.code === "23505") return { recorded: false };
    throw new Error(`Failed to record commission payment: ${error.message}`);
  }
  return { recorded: true };
}

// An admin can only record up to what the driver currently owes. A typo
// above that (₦50,000 for ₦5,000) would otherwise push the driver's balance
// positive — i.e. into money Pantra pays OUT through payouts, for cash it
// never received. Returns an error message, or null if the amount is fine.
export function adminSettlementAmountError(amount: number, amountOwed: number): string | null {
  if (!(amount > 0)) return "Amount must be greater than zero.";
  if (amountOwed <= 0) return "This driver doesn't owe any cash commission.";
  if (amount > amountOwed) {
    return `Amount is more than this driver owes (₦${amountOwed.toLocaleString()}). Record at most what they owe.`;
  }
  return null;
}
