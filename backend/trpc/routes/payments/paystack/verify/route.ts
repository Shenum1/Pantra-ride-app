import { z } from "zod";
import { publicProcedure } from "../../../../create-context";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY ?? "";

export default publicProcedure
  .input(z.object({ reference: z.string() }))
  .mutation(async ({ input }) => {
    if (!PAYSTACK_SECRET_KEY) {
      console.warn("⚠️ PAYSTACK_SECRET_KEY is not configured on the server");
      return {
        status: false,
        message: "Paystack is not configured. Please add PAYSTACK_SECRET_KEY to the server environment.",
      };
    }

    try {
      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(input.reference)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.status) {
        console.error("Paystack verification failed:", result);
        return {
          status: false,
          message: result.message || "Failed to verify payment",
        };
      }

      return {
        status: result.data?.status === "success",
        message: result.message,
        data: result.data,
      };
    } catch (error) {
      console.error("Error verifying Paystack transaction:", error);
      return {
        status: false,
        message: "Network error while contacting Paystack.",
      };
    }
  });
