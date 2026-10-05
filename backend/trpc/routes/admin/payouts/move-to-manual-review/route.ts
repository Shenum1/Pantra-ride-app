import { adminProcedure } from "../../../../create-context";
import { movePayoutToManualReview, movePayoutToManualReviewInput } from "../../../../../services/admin/payouts";

export default adminProcedure
  .input(movePayoutToManualReviewInput)
  .mutation(({ ctx, input }) => movePayoutToManualReview(ctx.supabaseAdmin, ctx.adminUserId, input));
