import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import paystackInitializeRoute from "./routes/payments/paystack/initialize/route";
import paystackVerifyRoute from "./routes/payments/paystack/verify/route";
import flutterwaveInitializeRoute from "./routes/payments/flutterwave/initialize/route";
import flutterwaveVerifyRoute from "./routes/payments/flutterwave/verify/route";
import adminOverviewRoute from "./routes/admin/overview/route";
import adminUsersRoute from "./routes/admin/users/route";
import adminDriverDocumentsRoute from "./routes/admin/driver-documents/route";
import adminReviewDocumentRoute from "./routes/admin/review-document/route";
import notifyDriversRoute from "./routes/notifications/notify-drivers/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  payments: createTRPCRouter({
    paystack: createTRPCRouter({
      initialize: paystackInitializeRoute,
      verify: paystackVerifyRoute,
    }),
    flutterwave: createTRPCRouter({
      initialize: flutterwaveInitializeRoute,
      verify: flutterwaveVerifyRoute,
    }),
  }),
  admin: createTRPCRouter({
    overview: adminOverviewRoute,
    users: adminUsersRoute,
    driverDocuments: adminDriverDocumentsRoute,
    reviewDocument: adminReviewDocumentRoute,
  }),
  notifications: createTRPCRouter({
    notifyDrivers: notifyDriversRoute,
  }),
});

export type AppRouter = typeof appRouter;
