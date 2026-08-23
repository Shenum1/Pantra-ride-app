import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import paystackInitializeRoute from "./routes/payments/paystack/initialize/route";
import paystackVerifyRoute from "./routes/payments/paystack/verify/route";
import flutterwaveInitializeRoute from "./routes/payments/flutterwave/initialize/route";
import flutterwaveVerifyRoute from "./routes/payments/flutterwave/verify/route";
import walletCreditRoute from "./routes/payments/wallet/credit/route";
import adminOverviewRoute from "./routes/admin/overview/route";
import adminUsersRoute from "./routes/admin/users/route";
import adminDriverDocumentsRoute from "./routes/admin/driver-documents/route";
import adminReviewDocumentRoute from "./routes/admin/review-document/route";
import adminRidesRoute from "./routes/admin/rides/route";
import ridesConfirmPaymentRoute from "./routes/rides/confirm-payment/route";
import adminPayoutsListRoute from "./routes/admin/payouts/list/route";
import adminPayoutsUpdateStatusRoute from "./routes/admin/payouts/update-status/route";
import adminDriverVerificationListRoute from "./routes/admin/driver-verification/list/route";
import adminDriverVerificationGetDriverDetailRoute from "./routes/admin/driver-verification/get-driver-detail/route";
import adminDriverVerificationDecideRoute from "./routes/admin/driver-verification/decide/route";
import notifyDriversRoute from "./routes/notifications/notify-drivers/route";
import driverVerificationGetStatusRoute from "./routes/driver-verification/get-status/route";
import driverVerificationSubmitProfileRoute from "./routes/driver-verification/submit-profile/route";
import driverVerificationSubmitDocumentRoute from "./routes/driver-verification/submit-document/route";
import driverVerificationSyncAuthStatusRoute from "./routes/driver-verification/sync-auth-verification-status/route";
import driverVerificationCheckExpiryRoute from "./routes/driver-verification/check-expiry/route";
import claimAdRewardRoute from "./routes/rewards/claim-ad-reward/route";
import getAdRewardStatusRoute from "./routes/rewards/get-ad-reward-status/route";
import tipsCreateRoute from "./routes/payments/tips/create/route";
import tipsGetForRideRoute from "./routes/payments/tips/get-for-ride/route";

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
    wallet: createTRPCRouter({
      credit: walletCreditRoute,
    }),
    tips: createTRPCRouter({
      create: tipsCreateRoute,
      getForRide: tipsGetForRideRoute,
    }),
  }),
  admin: createTRPCRouter({
    overview: adminOverviewRoute,
    users: adminUsersRoute,
    driverDocuments: adminDriverDocumentsRoute,
    reviewDocument: adminReviewDocumentRoute,
    rides: adminRidesRoute,
    payouts: createTRPCRouter({
      list: adminPayoutsListRoute,
      updateStatus: adminPayoutsUpdateStatusRoute,
    }),
    driverVerification: createTRPCRouter({
      list: adminDriverVerificationListRoute,
      getDriverDetail: adminDriverVerificationGetDriverDetailRoute,
      decide: adminDriverVerificationDecideRoute,
    }),
  }),
  rides: createTRPCRouter({
    confirmPayment: ridesConfirmPaymentRoute,
  }),
  driverVerification: createTRPCRouter({
    getStatus: driverVerificationGetStatusRoute,
    submitProfile: driverVerificationSubmitProfileRoute,
    submitDocument: driverVerificationSubmitDocumentRoute,
    syncAuthVerificationStatus: driverVerificationSyncAuthStatusRoute,
    checkExpiry: driverVerificationCheckExpiryRoute,
  }),
  notifications: createTRPCRouter({
    notifyDrivers: notifyDriversRoute,
  }),
  rewards: createTRPCRouter({
    claimAdReward: claimAdRewardRoute,
    getAdRewardStatus: getAdRewardStatusRoute,
  }),
});

export type AppRouter = typeof appRouter;
