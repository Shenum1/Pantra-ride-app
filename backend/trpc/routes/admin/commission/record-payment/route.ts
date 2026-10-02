import { z } from "zod";
import { adminProcedure } from "../../../../create-context";
import {
  adminSettlementAmountError,
  getCashCommissionStatus,
  recordCommissionSettlement,
} from "../../../../../lib/cash-commission";

// Records a cash-commission payment a driver made OUTSIDE the app — a bank
// transfer to Pantra's account, or cash at an office — after an admin has
// confirmed the money actually arrived. The in-app path (driver.commission.pay)
// records itself; this is the manual counterpart.
//
// Capped at what the driver currently owes (see adminSettlementAmountError),
// and idempotent on the transfer reference: the same reference can't be
// recorded twice, so a double-click or a repeated entry never double-credits.
export default adminProcedure
  .input(
    z.object({
      driverId: z.string().uuid(),
      amount: z.number().finite().positive(),
      externalReference: z.string().trim().min(1),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const amount = Math.round(input.amount * 100) / 100;

    const status = await getCashCommissionStatus(db, input.driverId);
    const amountError = adminSettlementAmountError(amount, status.amountOwed);
    if (amountError) throw new Error(amountError);

    const { recorded } = await recordCommissionSettlement(db, {
      driverId: input.driverId,
      amount,
      reference: input.externalReference,
      reason: input.notes?.trim()
        ? `Recorded by admin: ${input.notes.trim()}`
        : "Recorded by admin (bank transfer / cash)",
      createdBy: ctx.adminUserId,
    });
    if (!recorded) {
      throw new Error(`A commission payment with reference "${input.externalReference}" has already been recorded.`);
    }

    return getCashCommissionStatus(db, input.driverId);
  });
