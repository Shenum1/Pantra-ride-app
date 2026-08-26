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
import adminPricingTiersListRoute from "./routes/admin/pricing/tiers/list/route";
import adminPricingTiersUpdateRoute from "./routes/admin/pricing/tiers/update/route";
import adminPricingTrafficRulesListRoute from "./routes/admin/pricing/traffic-rules/list/route";
import adminPricingTrafficRulesCreateRoute from "./routes/admin/pricing/traffic-rules/create/route";
import adminPricingTrafficRulesUpdateRoute from "./routes/admin/pricing/traffic-rules/update/route";
import adminPricingTrafficRulesDeleteRoute from "./routes/admin/pricing/traffic-rules/delete/route";
import adminPricingPriorityGetRoute from "./routes/admin/pricing/priority/get/route";
import adminPricingPriorityUpdateRoute from "./routes/admin/pricing/priority/update/route";
import adminPricingSurgeGetRoute from "./routes/admin/pricing/surge/get/route";
import adminPricingSurgeUpdateRoute from "./routes/admin/pricing/surge/update/route";
import adminPricingCommissionGetRoute from "./routes/admin/pricing/commission/get/route";
import adminPricingCommissionUpdateRoute from "./routes/admin/pricing/commission/update/route";
import adminPricingWaitingChargeGetRoute from "./routes/admin/pricing/waiting-charge/get/route";
import adminPricingWaitingChargeUpdateRoute from "./routes/admin/pricing/waiting-charge/update/route";
import adminPricingCancellationFeeGetRoute from "./routes/admin/pricing/cancellation-fee/get/route";
import adminPricingCancellationFeeUpdateRoute from "./routes/admin/pricing/cancellation-fee/update/route";
import adminPromotionsListRoute from "./routes/admin/promotions/list/route";
import adminPromotionsCreateRoute from "./routes/admin/promotions/create/route";
import adminPromotionsUpdateRoute from "./routes/admin/promotions/update/route";
import adminPromotionsUsageRoute from "./routes/admin/promotions/usage/route";
import adminRidersGetDetailRoute from "./routes/admin/riders/get-detail/route";
import adminRidersGetWalletTransactionsRoute from "./routes/admin/riders/get-wallet-transactions/route";
import adminPaymentsTransactionsRoute from "./routes/admin/payments/transactions/route";
import adminPaymentsTipsRoute from "./routes/admin/payments/tips/route";
import adminSupportListRoute from "./routes/admin/support/list/route";
import adminSupportGetDetailRoute from "./routes/admin/support/get-detail/route";
import adminSupportReplyRoute from "./routes/admin/support/reply/route";
import adminSupportUpdateStatusRoute from "./routes/admin/support/update-status/route";
import supportCreateTicketRoute from "./routes/support/create-ticket/route";
import supportListMyTicketsRoute from "./routes/support/list-my-tickets/route";
import supportGetTicketRoute from "./routes/support/get-ticket/route";
import supportReplyRoute from "./routes/support/reply/route";
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
    pricing: createTRPCRouter({
      tiers: createTRPCRouter({
        list: adminPricingTiersListRoute,
        update: adminPricingTiersUpdateRoute,
      }),
      trafficRules: createTRPCRouter({
        list: adminPricingTrafficRulesListRoute,
        create: adminPricingTrafficRulesCreateRoute,
        update: adminPricingTrafficRulesUpdateRoute,
        delete: adminPricingTrafficRulesDeleteRoute,
      }),
      priority: createTRPCRouter({
        get: adminPricingPriorityGetRoute,
        update: adminPricingPriorityUpdateRoute,
      }),
      surge: createTRPCRouter({
        get: adminPricingSurgeGetRoute,
        update: adminPricingSurgeUpdateRoute,
      }),
      commission: createTRPCRouter({
        get: adminPricingCommissionGetRoute,
        update: adminPricingCommissionUpdateRoute,
      }),
      waitingCharge: createTRPCRouter({
        get: adminPricingWaitingChargeGetRoute,
        update: adminPricingWaitingChargeUpdateRoute,
      }),
      cancellationFee: createTRPCRouter({
        get: adminPricingCancellationFeeGetRoute,
        update: adminPricingCancellationFeeUpdateRoute,
      }),
    }),
    promotions: createTRPCRouter({
      list: adminPromotionsListRoute,
      create: adminPromotionsCreateRoute,
      update: adminPromotionsUpdateRoute,
      usage: adminPromotionsUsageRoute,
    }),
    riders: createTRPCRouter({
      getDetail: adminRidersGetDetailRoute,
      getWalletTransactions: adminRidersGetWalletTransactionsRoute,
    }),
    payments: createTRPCRouter({
      transactions: adminPaymentsTransactionsRoute,
      tips: adminPaymentsTipsRoute,
    }),
    support: createTRPCRouter({
      list: adminSupportListRoute,
      getDetail: adminSupportGetDetailRoute,
      reply: adminSupportReplyRoute,
      updateStatus: adminSupportUpdateStatusRoute,
    }),
  }),
  support: createTRPCRouter({
    createTicket: supportCreateTicketRoute,
    listMyTickets: supportListMyTicketsRoute,
    getTicket: supportGetTicketRoute,
    reply: supportReplyRoute,
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
