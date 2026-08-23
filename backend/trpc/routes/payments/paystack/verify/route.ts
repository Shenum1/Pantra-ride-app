import { z } from "zod";
import { publicProcedure } from "../../../../create-context";
import { verifyPaystackTransaction } from "../../../../../lib/payment-providers";

export default publicProcedure
  .input(z.object({ reference: z.string() }))
  .mutation(async ({ input }) => {
    const result = await verifyPaystackTransaction(input.reference);

    return {
      status: result.success,
      message: result.message,
      data: result.raw?.data,
    };
  });
