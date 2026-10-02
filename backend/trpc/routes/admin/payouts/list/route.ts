import { z } from "zod";
import { adminProcedure } from "../../../../create-context";
import { flutterwaveTransferMayExist } from "../../../../../lib/payout-processor";

export default adminProcedure
  .input(
    z.object({
      status: z.enum(["pending", "processing", "manual_review", "completed", "failed", "reversed"]).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    })
  )
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    let query = db
      .from("driver_payouts")
      .select(
        "id, driverId, amount, bankAccountId, status, payoutMethod, provider, providerTransferReference, providerTransferCode, failureReason, requestedAt, processingStartedAt, completedAt",
        { count: "exact" }
      )
      .order("requestedAt", { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    if (input.status) {
      query = query.eq("status", input.status);
    }

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    const payoutIds = (data ?? []).map((p) => p.id);
    const driverIds = [...new Set((data ?? []).map((p) => p.driverId).filter(Boolean))];
    const bankAccountIds = [...new Set((data ?? []).map((p) => p.bankAccountId).filter(Boolean))];

    const [driversRes, bankRes, manualActionsRes, reconciliationRes, attemptsRes] = await Promise.all([
      driverIds.length > 0
        ? db.from("drivers").select("id, name, email").in("id", driverIds)
        : Promise.resolve({ data: [] as { id: string; name: string; email: string }[] }),
      bankAccountIds.length > 0
        ? db
            .from("driver_bank_accounts")
            .select("id, bankName, accountNumberLast4, accountName")
            .in("id", bankAccountIds)
        : Promise.resolve({ data: [] as { id: string; bankName: string; accountNumberLast4: string; accountName: string }[] }),
      payoutIds.length > 0
        ? db
            .from("payout_manual_actions")
            .select("id, payoutId, adminUserId, action, externalReference, notes, createdAt")
            .in("payoutId", payoutIds)
            .order("createdAt", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      payoutIds.length > 0
        ? db
            .from("payment_reconciliation_records")
            .select("payoutId")
            .in("payoutId", payoutIds)
            .eq("reconciliationStatus", "open")
        : Promise.resolve({ data: [] as { payoutId: string }[] }),
      payoutIds.length > 0
        ? db.from("payout_provider_attempts").select("payoutId, attemptStatus").in("payoutId", payoutIds)
        : Promise.resolve({ data: [] as { payoutId: string; attemptStatus: string }[] }),
    ]);

    const driverMap = new Map((driversRes.data ?? []).map((d) => [d.id, { name: d.name, email: d.email }]));
    const bankMap = new Map(
      (bankRes.data ?? []).map((b) => [
        b.id,
        { bankName: b.bankName, accountNumberLast4: b.accountNumberLast4, accountName: b.accountName },
      ])
    );
    const manualActionsByPayout = new Map<string, any[]>();
    for (const action of manualActionsRes.data ?? []) {
      const list = manualActionsByPayout.get(action.payoutId) ?? [];
      list.push(action);
      manualActionsByPayout.set(action.payoutId, list);
    }
    const openReconciliationPayoutIds = new Set((reconciliationRes.data ?? []).map((r) => r.payoutId));
    const attemptStatusesByPayout = new Map<string, string[]>();
    for (const attempt of attemptsRes.data ?? []) {
      const list = attemptStatusesByPayout.get(attempt.payoutId) ?? [];
      list.push(attempt.attemptStatus);
      attemptStatusesByPayout.set(attempt.payoutId, list);
    }

    const payouts = (data ?? []).map((p) => ({
      ...p,
      driver: driverMap.get(p.driverId) ?? null,
      bankAccount: p.bankAccountId ? (bankMap.get(p.bankAccountId) ?? null) : null,
      manualActions: manualActionsByPayout.get(p.id) ?? [],
      hasOpenReconciliation: openReconciliationPayoutIds.has(p.id),
      // Same rule admin.payouts.completeManually enforces server-side: a
      // Flutterwave transfer may exist but can't be looked up, so manual
      // completion needs the admin to confirm against the dashboard first.
      needsProviderConfirmation:
        p.provider === "flutterwave" &&
        !p.providerTransferCode &&
        flutterwaveTransferMayExist(attemptStatusesByPayout.get(p.id) ?? []),
    }));

    return { payouts, total: count ?? 0 };
  });
