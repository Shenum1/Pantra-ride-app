import { z } from "zod";
import { publicProcedure } from "../../../../create-context";

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY ?? "";

export default publicProcedure
  .input(z.object({ transactionIdOrReference: z.string() }))
  .mutation(async ({ input }) => {
    if (!FLUTTERWAVE_SECRET_KEY) {
      console.warn("⚠️ FLUTTERWAVE_SECRET_KEY is not configured on the server");
      return {
        status: "error" as const,
        message: "Flutterwave is not configured. Please add FLUTTERWAVE_SECRET_KEY to the server environment.",
      };
    }

    const value = input.transactionIdOrReference;
    const isReference = value.startsWith("FLW-") || value.startsWith("PANTRA-");
    const verifyUrl = isReference
      ? `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(value)}`
      : `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(value)}/verify`;

    try {
      const response = await fetch(verifyUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}` },
      });

      const result = await response.json();

      if (result.status !== "success") {
        console.error("Flutterwave verification failed:", result);
        return {
          status: "error" as const,
          message: result.message || "Failed to verify payment",
        };
      }

      return {
        status: "success" as const,
        message: result.message,
        data: result.data,
      };
    } catch (error) {
      console.error("Error verifying Flutterwave transaction:", error);
      return {
        status: "error" as const,
        message: "Network error while contacting Flutterwave.",
      };
    }
  });
