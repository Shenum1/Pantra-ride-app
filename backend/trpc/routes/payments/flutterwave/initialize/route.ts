import { z } from "zod";
import { publicProcedure } from "../../../../create-context";

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY ?? "";

export default publicProcedure
  .input(
    z.object({
      amount: z.number().positive(),
      email: z.string().email(),
      phone_number: z.string().optional(),
      name: z.string().optional(),
      tx_ref: z.string().optional(),
      redirect_url: z.string().optional(),
      meta: z.record(z.string(), z.any()).optional(),
    })
  )
  .mutation(async ({ input }) => {
    if (!FLUTTERWAVE_SECRET_KEY) {
      console.warn("⚠️ FLUTTERWAVE_SECRET_KEY is not configured on the server");
      return {
        status: "error" as const,
        message: "Flutterwave is not configured. Please add FLUTTERWAVE_SECRET_KEY to the server environment.",
      };
    }

    const tx_ref = input.tx_ref || `FLW-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

    try {
      const response = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref,
          amount: input.amount,
          currency: "NGN",
          redirect_url: input.redirect_url || "https://rork.app/payment-callback",
          payment_options: "card,banktransfer,ussd,mobilemoney",
          customer: {
            email: input.email,
            phonenumber: input.phone_number,
            name: input.name || "Customer",
          },
          customizations: {
            title: "Ride Payment",
            description: "Payment for ride service",
            logo: "https://rork.app/logo.png",
          },
          meta: input.meta,
        }),
      });

      const result = await response.json();

      if (result.status !== "success") {
        console.error("Flutterwave initialization failed:", result);
        return {
          status: "error" as const,
          message: result.message || "Failed to initialize payment",
        };
      }

      return {
        status: "success" as const,
        message: "Payment initialized successfully",
        data: result.data,
      };
    } catch (error) {
      console.error("Error initializing Flutterwave payment:", error);
      return {
        status: "error" as const,
        message: "Network error while contacting Flutterwave.",
      };
    }
  });
