import { z } from "zod";
import { publicProcedure } from "../../../../create-context";
import { verifyFlutterwaveTransaction } from "../../../../../lib/payment-providers";

export default publicProcedure
  .input(z.object({ transactionIdOrReference: z.string() }))
  .mutation(async ({ input }) => {
    const result = await verifyFlutterwaveTransaction(input.transactionIdOrReference);

    return {
      status: (result.success ? "success" : "error") as "success" | "error",
      message: result.message,
      data: result.raw?.data,
    };
  });
