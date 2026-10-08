# Pantra Cancellation & Refund Policy

**Version 1.0 — DRAFT for legal review**
**Effective date:** **BUSINESS DECISION REQUIRED**
**Applies to:** riders and drivers. This policy is part of the [Terms of Service](terms-of-service.md).

> Markers: **BUSINESS DECISION REQUIRED** · **CONFIRM** · *(Pending implementation — see DEVLOG 2026-10-06)* · **LEGAL REVIEW REQUIRED**. Remove before publishing.
>
> This policy is the **only** place the cancellation fee amounts are stated. Other documents refer here.

---

## 1. Cancelling as a rider

You can cancel a ride in the app at any time before the trip starts. Whether you pay a fee depends on how far the driver has got:

| When you cancel | Fee |
|---|---|
| Before a driver accepts your request | Free |
| Within **60 seconds** after a driver accepts | Free |
| More than 60 seconds after a driver accepts, before they arrive | **₦200** |
| After the driver has arrived at your pickup point | **₦500** |

**CONFIRM — these are the amounts currently configured in Pantra. Pantra can change them; this policy must be updated whenever they change.**

Before you confirm a cancellation, the app shows you whether a fee will apply and how much. *(Pending implementation — see DEVLOG 2026-10-06, item 1)*

**How the fee is paid.**
- If you chose **wallet**, the fee is taken from your Pantra Wallet. *(Pending implementation — see DEVLOG 2026-10-06, item 1)*
- If you chose **cash**, **BUSINESS DECISION REQUIRED — how a cash rider pays a cancellation fee (for example, added to their next ride or taken from their wallet).**

**Who receives the fee.** The cancellation fee is treated like a fare: the driver receives it, less Pantra's commission (see the [Driver Earnings & Payout Policy](driver-earnings-payout-policy.md)). *(Pending implementation — see DEVLOG 2026-10-06, item 1)*

**Promo codes.** If you used a promo code on a ride you cancel, the code is not returned to you. **BUSINESS DECISION REQUIRED — whether a promo code should be restored after a cancellation.**

## 2. Cancelling as a driver

Drivers can cancel an accepted ride in the app, for example if they cannot reach the pickup point, the rider cannot be found, or they feel unsafe.

- The rider is **not charged** when a driver cancels. *(Pending implementation — today the system may record a fee on a driver-cancelled ride; see DEVLOG 2026-10-06, item 1)*
- There is currently no fee for drivers who cancel.
- **BUSINESS DECISION REQUIRED — whether frequent driver cancellations lead to warnings or account review.**
- **BUSINESS DECISION REQUIRED — whether a driver who waits and the rider does not show up ("no-show") should be treated differently from a rider cancellation.**

When a driver cancels, you can request a new ride.

## 3. Failed payments

**Wallet top-ups.** If a top-up fails, your wallet is not credited. If money left your account but the top-up shows as failed or pending, it is usually because the payment provider has not confirmed it yet. We check the payment directly with Flutterwave; if it succeeded, your wallet will be credited. If your bank deducted money but the top-up was not credited, contact support with the payment reference.

**Ride payments by wallet.** If your wallet balance does not cover the fare at the end of the trip, the payment cannot be completed. **BUSINESS DECISION REQUIRED — what happens next (for example: rider tops up and pays in the app, pays the driver in cash, or the amount is recorded as owed).**

## 4. Duplicate payments

Our system checks every payment reference so the same top-up cannot be credited twice and a ride cannot be paid twice. If you think you have been charged twice, contact support with the details. If a duplicate charge is confirmed, we will refund it.

## 5. Refunds

**When you can ask for a refund.** You can ask for a refund if, for example:
- you were charged for a ride that did not happen;
- you were charged more than you should have been (for example, a wrong waiting or cancellation charge);
- a wallet top-up was charged twice;
- something else went wrong with a charge.

**How to ask.** Go to **Help & Support → Report an Issue**, choose **Payment**, and tell us the ride or transaction. Pantra staff review every refund request. **BUSINESS DECISION REQUIRED — the time limit for asking for a refund and our response time.**

**How refunds are paid.**
- **Rides paid from your wallet** are refunded to your **Pantra Wallet**, in full or in part.
- **Wallet top-ups** can be refunded to your original payment method through Flutterwave, but only for money you have not yet spent. The refunded amount is taken out of your wallet first.
- **Cash rides cannot be refunded through the app.** If you have a complaint about a cash ride, contact support and we will look into it. **BUSINESS DECISION REQUIRED — whether Pantra will ever compensate cash riders (for example, with wallet credit).**

A refund can never be more than the original amount paid.

**Unused wallet balance.** The Pantra Wallet is for paying for rides and tips. You cannot withdraw your balance as cash. **BUSINESS DECISION REQUIRED / LEGAL REVIEW REQUIRED — whether riders can get unused balances refunded, including when they close their account.**

## 6. How long refunds take

- **Wallet refunds** appear in your Pantra Wallet once approved.
- **Refunds to your card or bank** depend on Flutterwave and your bank, and can take several working days after we approve them. **BUSINESS DECISION REQUIRED — do not state a fixed number of days until confirmed with Flutterwave.**

## 7. Disputes

If you disagree with a charge or a refund decision, reply on your support ticket and ask for it to be reviewed. **BUSINESS DECISION REQUIRED — escalation path (who reviews a second time).**

If you raise a dispute with your bank or card issuer (a "chargeback") instead of contacting us, we may pause the related wallet balance while the dispute is open. **LEGAL REVIEW REQUIRED.**

See also the [Payment Policy](payment-policy.md) and [Terms of Service](terms-of-service.md) section 21.

## 8. Effect on drivers

When a rider is refunded for a ride, Pantra may adjust the driver's earnings for that ride. See the [Driver Earnings & Payout Policy](driver-earnings-payout-policy.md).
