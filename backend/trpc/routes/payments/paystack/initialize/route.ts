import { z } from "zod";
import { publicProcedure } from "../../../../create-context";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY ?? "";

export default publicProcedure
  .input(
    z.object({
      amount: z.number().positive(),
      email: z.string().email(),
      reference: z.string().optional(),
      callback_url: z.string().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
    })
  )
  .mutation(async ({ input }) => {
    if (!PAYSTACK_SECRET_KEY) {
      console.warn("⚠️ PAYSTACK_SECRET_KEY is not configured on the server");
      return {
        status: false,
        message: "Paystack is not configured. Please add PAYSTACK_SECRET_KEY to the server environment.",
      };
    }

    const reference = input.reference || `TXN-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const amountInKobo = Math.round(input.amount * 100);

    try {
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: input.email,
          amount: amountInKobo,
          reference,
          currency: "NGN",
          callback_url: input.callback_url,
          metadata: input.metadata,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.status) {
        console.error("Paystack initialization failed:", result);
        return {
          status: false,
          message: result.message || "Failed to initialize payment",
        };
      }

      return {
        status: true,
        message: "Transaction initialized successfully",
        data: result.data,
      };
    } catch (error) {
      console.error("Error initializing Paystack transaction:", error);
      return {
        status: false,
        message: "Network error while contacting Paystack.",
      };
    }
  });
