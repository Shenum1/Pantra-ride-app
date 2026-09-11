# Pantra — Payment & Financial Transaction Architecture Audit

**Audit date:** 2026-09-11
**Scope:** Full payment, wallet, commission, driver-earnings, payout, and tip pipeline — mobile app, backend (tRPC), Supabase/Postgres, admin-web.
**Status:** Audit only. No code, schema, or configuration was changed to produce this report.

---

## A. EXECUTIVE SUMMARY

Pantra's money movement is built on three real, working pieces of infrastructure and one significant unbuilt piece:

1. **A rider wallet** (`wallets`/`wallet_transactions`) with a single atomic, row-locking Postgres function (`add_wallet_transaction`) that is the only way any wallet balance ever changes. It correctly rejects overdrafts and, since this session, correctly restricts who may *credit* a wallet (only the backend, after re-verifying a real Paystack/Flutterwave payment) versus *debit* it (the wallet owner themselves, for legitimate self-service spends).
2. **A ride settlement trigger** (`rides_settle_trigger`, Postgres `BEFORE UPDATE` on `rides`) that is now the actual source of truth for commission math and payment gating: a ride cannot become `status='completed'` unless `paymentStatus='paid'` in the same statement, and the 10%/90% split is computed server-side from trusted fare/fee columns, overriding anything a client proposes. Once settled, the row's financial columns are immutable.
3. **A real payment-confirmation step** (`rides.confirmPayment`, a backend route called by the driver's app right before it marks a ride complete) that, for wallet-paid rides, actually debits the rider's wallet for the fare before allowing settlement. This closes what was, earlier in this engagement, a genuine gap (a ride could complete with no money ever having moved for a wallet-selected payment method).
4. **No card payment at ride checkout, and no payment-provider webhooks.** Paystack/Flutterwave are only wired into wallet top-up, not into paying for a ride directly by card. Payment confirmation for wallet top-ups is driven by the client calling a `verify` endpoint after returning from checkout — there is no webhook receiver anywhere in the codebase, so a payment that succeeds at the provider but never gets verified client-side (app killed, network drop) leaves Pantra with no record of it.

On top of this core, the codebase now also has a real driver-payout system (withdrawal requests validated against a server-computed available balance, admin-approved, RLS-locked so a driver cannot self-approve), a tips feature (100%-driver, 0%-platform, its own transaction table, idempotent), and an extensive admin panel for viewing (not editing) financial records and editing *forward-looking* pricing policy (commission rate, tier rates, surge, fees) — never individual transaction amounts.

The most consequential open items are: **no webhook-based payment confirmation** (single point of failure is the client), **no reconciliation capability against Paystack/Flutterwave**, **unrounded floating-point commission math** (fractional-kobo values are computed and stored, intentionally, but nothing downstream truncates them to 2dp), **plaintext bank account numbers at rest**, and **no environment separation** between dev/staging/production credentials.

---

## B. CURRENT ARCHITECTURE — END-TO-END FLOW

```
RIDER REQUESTS RIDE
  app/ride-checkout.tsx -> hooks/useRideStore.ts:requestRide()
  Fare computed CLIENT-SIDE via lib/fare-calculator.ts (calculateFareBreakdown/
  calculateFare), using live-fetched pricing_tier_config (falls back to
  hardcoded TIER_RATES). Written directly to `rides` via a plain Supabase
  client insert (DatabaseService.create) — the rider's own authenticated
  session, gated only by RLS ("Rider can create rides": auth.uid()=userId).
  paymentMethod stored as either the literal 'cash' or a payment_methods.id.
        |
DRIVER ACCEPTS
  lib/firebase-driver-service.ts:acceptRide — direct client write,
  rides.driverId = drivers.id, status='accepted'.
        |
RIDE STARTS / IN PROGRESS
  FirebaseDriverService.updateRideStatus('in_progress') — direct client
  write; computes and adds any waiting charge to `fare` here.
        |
DRIVER TAPS "COMPLETE TRIP"
  hooks/useDriverStore.ts:updateRideStatus('completed')
        |
  --> backend: rides.confirmPayment (driverProcedure)
      - Resolves driverId server-side from the caller's own session
        (never trusts a client-supplied id).
      - Verifies this driver owns the ride, ride isn't already terminal.
      - If already paymentStatus='paid', short-circuits (idempotent).
      - If paymentMethod resolves to a payment_methods row with type='wallet':
        debits the RIDER's wallet for the fare via add_wallet_transaction,
        running as service_role (so it can debit the rider's wallet from the
        driver's own session — the only place allowed to do this).
        Insufficient balance -> the whole call fails, nothing is marked paid.
      - Cash/card rides: no real charge exists yet, so this step just marks
        paymentStatus='paid' outright (documented limitation, see §E/§K).
      - Sets rides.paymentStatus='paid'.
        |
  <-- on success, the driver client proceeds:
      FirebaseDriverService.updateRideStatus('completed') — direct client
      write of status='completed' (+ trackingStage/statusText/etc). This hits
      the `rides_settle_guard` BEFORE UPDATE trigger:
        - Requires NEW.paymentStatus = 'paid' (already true from the step
          above) or REJECTS the whole update.
        - Recomputes platformCommissionRate/platformCommissionAmount/
          driverEarningsAmount server-side from fare/fee columns and the
          current rate in platform_commission_config, overriding any
          client-supplied values for those three columns.
        - If OLD.status was already 'completed'/'cancelled', rejects any
          further settlement attempt outright (no double-crediting).
      The RIDER's client (hooks/useRideStore.ts:savePastRide) independently
      performs an equivalent write for its own local state — both call sites
      converge on the same trigger-enforced numbers, and the trigger's
      immutability guard makes the second, redundant write a no-op-or-reject
      rather than a double-settlement.
        |
DRIVER EARNINGS / STATS COMPUTED
  lib/firebase-driver-service.ts:getDriverEarnings/getDriverStats — read-time
  aggregation over `rides` (preferring the settled snapshot columns) plus
  `tips` (successful only). No separate "earnings" table is written to at
  settlement time beyond the snapshot columns on `rides` itself.
        |
DRIVER REQUESTS WITHDRAWAL
  lib/driver-wallet-service.ts:requestWithdrawal — direct client insert into
  driver_payouts. A BEFORE INSERT trigger (driver_payouts_check_balance)
  takes an advisory lock and rejects the insert if amount exceeds
  get_driver_available_balance() (ride earnings + tips − payouts already
  pending/processing/completed).
        |
ADMIN APPROVES/REJECTS
  backend/trpc/routes/admin/payouts/update-status/route.ts (adminProcedure,
  service-role) — flips status/failureReason/completedAt only. No real bank
  transfer API call exists (see §L).
```

**Wallet top-up (separate flow, feeds the wallet debited above):**
```
Rider picks Paystack or Flutterwave -> backend initializes a transaction
  (payments.paystack.initialize / payments.flutterwave.initialize) ->
  rider completes checkout in an external browser ->
  rider (or a deep-link callback) triggers verification ->
  backend re-verifies the reference directly with the provider
  (backend/lib/payment-providers.ts) -> if genuinely successful, backend
  calls payments.wallet.credit, which re-verifies AGAIN and credits the
  wallet via add_wallet_transaction using the PROVIDER'S confirmed amount,
  never the client's.
```
There is **no webhook** anywhere in this flow — see §M.

---

## C. MONEY REPRESENTATION

Every monetary column in the schema is Postgres `numeric` (arbitrary-precision decimal), storing **whole Naira**, not kobo. Nothing in the schema enforces 2-decimal-place scale except `driver_payouts.amount NUMERIC(12,2)` and `promotions.discountPercentage/maxDiscountNGN`, which are the only columns with an explicit `(precision,scale)`.

| Table | Field | Current Type | Current Unit | Recommended Type | Recommended Unit | Risk |
|---|---|---|---|---|---|---|
| `rides` | `fare`, `baseFare`, `minFare`, `maxFare`, `bookingFee`, `serviceFee`, `zoneFee`, `waitingCharge`, `priorityFee`, `cancellationFee`, `offeredFare` | `numeric` (unscaled) | Naira | `numeric(12,2)` or `bigint` (kobo) | Naira, 2dp scale enforced | 🟡 Medium — unscaled numeric accepts arbitrary decimals silently |
| `rides` | `platformCommissionAmount`, `driverEarningsAmount` | `numeric` (unscaled) | Naira | same as above | same | 🟠 High — these are the two columns that actually receive unrounded floating-point-derived values today (see §E) |
| `drivers` | `earnings` (today/thisWeek/thisMonth/total) | **`jsonb`** | Naira | proper numeric columns, or drop entirely in favor of the `rides`/`tips` read-time aggregation already used elsewhere | Naira, 2dp | 🟠 High — no type/constraint enforcement at all inside a JSON blob; already a second, divergent source of "driver earnings" alongside the `DriverStats` computed from `rides` (see §I) |
| `wallets` | `balance` | `numeric` (unscaled) | Naira | `numeric(12,2)` | Naira, 2dp | 🟡 Medium |
| `wallet_transactions` | `amount` | `numeric` (unscaled) | Naira | `numeric(12,2)` | Naira, 2dp | 🟡 Medium |
| `tips` | `amount` | `numeric` (unscaled, `check > 0`) | Naira | `numeric(12,2)` | Naira, 2dp | 🟢 Low — app-level validation already forces whole-Naira integers before this is ever written |
| `driver_payouts` | `amount` | `numeric(12,2)` | Naira | (already correct) | Naira, 2dp | 🟢 Low |
| `pricing_tier_config`, `pricing_priority_config`, `waiting_charge_config`, `cancellation_fee_config` | fee/rate fields | `numeric` (unscaled) | Naira | `numeric(10,2)` | Naira, 2dp | 🟢 Low — admin-entered, low blast radius |
| `platform_commission_config` | `rate` | `numeric` | fraction (0–1) | (fine as-is) | fraction | 🟢 Low |

**Should Pantra move to integer kobo?** 🔵 **Business/architecture decision, not purely technical.** Two honest options:
- **Keep Naira-as-numeric, add explicit `(12,2)` scale everywhere, and fix the one real rounding gap (§E).** This is the smaller change and is proportionate to Pantra's actual current problem — the drift that exists today is a rounding-precision issue, not a magnitude/unit-confusion issue (the app never mixes kobo and Naira internally; only the Paystack API boundary does, and that conversion is already handled correctly — see §E item 4).
- **Migrate to integer minor units (kobo) everywhere**, the standard pattern for payment systems. This is more defensive long-term (eliminates floating-point representation error at the source) but is a real migration across every financial table and every read site, for a risk that is currently latent (no reported reconciliation mismatch), not active. Recommend deferring this unless/until Pantra's transaction volume or an actual observed reconciliation discrepancy justifies the migration cost.

**Recommendation:** do the smaller fix now (§E — round commission/earnings to 2dp at the point of computation, add `numeric(12,2)` scale to the columns above), and revisit full kobo migration only if reconciliation work (§R, currently absent) surfaces real drift.

---

## D. FARE ENGINE

**Formula** (`lib/fare-calculator.ts:calculateFareBreakdown`, `applyRideDiscounts`, `calculateDriverPayout`), exact order of operations:

1. `meteredRaw = base + (distanceKm × perKm) + (durationMin × perMin)`, rounded once (`Math.round`).
2. Clamped to the tier's `minFare` (minimum-fare floor applied **before** surge — order matters, confirmed by an explicit test in `testing/unit/fare-calculator.test.ts`).
3. Multiplied by `surgeMultiplier × trafficMultiplier`, rounded again → `meteredSubtotal`.
4. (Caller's responsibility, `applyRideDiscounts`) shared-ride discount and/or promo-code discount applied to the metered subtotal only, each rounded, then re-clamped to `minFare`.
5. Flat fees added on top, never discounted/surged/negotiated: `bookingFee + serviceFee + zoneFee + priorityFee`.
6. `waitingCharge` computed separately once the trip starts (`calculateWaitingCharge`, driver-arrival-to-trip-start), added directly to `fare` at that point.
7. `cancellationFee` (rider-initiated, time-window-based) computed separately at cancel time; replaces `fare` for a cancelled ride's settlement.
8. At settlement, `calculateDriverPayout` computes `meteredFare = fare − bookingFee − serviceFee − zoneFee − waitingCharge − priorityFee`, `commission = meteredFare × rate`, `driverEarnings = fare − commission` — i.e. commission applies only to the metered portion; flat platform fees are 100% platform revenue and `waitingCharge` is 100% driver compensation, neither ever multiplied by the commission rate.

**Where it runs:** initial fare is computed **client-side** (rider's device, using either the hardcoded `TIER_RATES`/`*_CONFIG` fallback constants in `lib/pricing-config.ts` or the live, admin-editable config tables fetched at request time) and written directly to `rides` by the rider's own Supabase session. **The commission split (step 8) is recomputed server-side, authoritatively, by `rides_settle_trigger`** at the moment a ride settles — this is the one part of the fare pipeline that is genuinely server-authoritative and cannot be overridden by the client.

**🔴 Critical security finding, `fare` itself is client-trusted before settlement:** RLS policy `"Rider or driver can update ride"` on `public.rides` permits either the rider or the driver to write **any** column on their own ride at any point before it settles — including `fare`, `baseFare`, `bookingFee`, etc. Nothing server-side validates that `fare` on a ride actually matches `distance`/`duration`/tier rates before the settlement trigger fires. The trigger correctly recomputes *commission from fare*, but it trusts `fare` itself as input. A colluding rider+driver pair (or a single compromised client calling the Supabase REST API directly with a valid session, bypassing the app's own UI entirely) could inflate `fare` before completion and inflate both driver earnings and platform commission on a fabricated number, or deflate it to under-pay commission on a real trip. This is a real, currently-open gap — not closed by anything shipped this session. Closing it fully requires moving ride-lifecycle fare writes behind a backend route (so the server can independently verify `fare` against `distance`/`duration`/tier before accepting it), which is a larger architectural change than a trigger tweak.

---

## E. PAYMENT PROVIDERS

**Both Paystack and Flutterwave are wired, but only for wallet top-up — neither is connected to paying for a ride directly.**

| | Paystack | Flutterwave |
|---|---|---|
| Initialize | `backend/trpc/routes/payments/paystack/initialize/route.ts` — `POST https://api.paystack.co/transaction/initialize`, amount converted to kobo (`Math.round(amount * 100)`) | `backend/trpc/routes/payments/flutterwave/initialize/route.ts` — `POST https://api.flutterwave.com/v3/payments`, amount sent as-is (Naira, major units) |
| Verify | `backend/lib/payment-providers.ts:verifyPaystackTransaction` — `GET /transaction/verify/:reference`, success = `data.status === 'success'`, amount converted back from kobo (`/100`) | `backend/lib/payment-providers.ts:verifyFlutterwaveTransaction` — checks `data.status === 'successful'` (not just the outer `status:"success"` wrapper, which only reflects the API call succeeding, not the charge — this was a real bug found and fixed this session) |
| Reference generation | `TXN-${timestamp}-${random}` — client- or server-generated, not collision-checked against the DB, but effectively unique in practice | `FLW-${timestamp}-${random}`, same pattern |
| Signature verification | N/A — no webhook exists to verify a signature on | N/A — same |
| Secret key | `PAYSTACK_SECRET_KEY`, server-only, never in client bundle (confirmed) | `FLUTTERWAVE_SECRET_KEY`, same |
| Public key | `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY` — not actually used in the current flow (checkout is hosted-page redirect, not inline SDK) | `EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY` — same |
| Test/live | `.env` currently has Paystack still at literal placeholder values (`sk_test_xxxxxxxxxxxxx`) — **Paystack is not actually configured/operational in this environment**; Flutterwave has real-shaped test credentials | |
| Status mapping | Normalized into a single `VerifiedPayment { success, amount, currency, message }` shape in `backend/lib/payment-providers.ts`, consumed uniformly by `payments.wallet.credit` regardless of gateway | |

**Which is primary?** Neither is designated "primary" in code — the rider picks a gateway at top-up time (`app/payment-gateway-select.tsx`). Given Paystack's placeholder secret key, **Flutterwave is the only one actually operational today**; this is a configuration gap, not a code gap (🔵 business/ops task: populate real Paystack credentials, or explicitly decide to launch with Flutterwave only).

**Verification amount trust:** ✅ correct — `payments.wallet.credit` uses the provider's own confirmed `amount`, never a client-supplied figure, closing what was a real vulnerability earlier in this engagement.

---

## F. PAYMENT STATE MACHINE

`rides.paymentStatus`: `unpaid → paid`, or `unpaid → failed`. (`pending` is declared in the CHECK constraint but nothing in the current code path ever sets it — confirm-payment either succeeds synchronously or fails synchronously; there's no genuinely async pending window for a wallet debit. `failed` is likewise declared but not currently written anywhere — a failed `confirmPayment` call just returns an error to the client without persisting a `failed` status row.)

`wallet_transactions.status`: `completed | pending | failed`. In practice, everything the app writes is `completed` immediately (`add_wallet_transaction` doesn't itself set anything to `pending`) except driver-payout-style withdrawals via the rider-wallet withdraw flow, which are inserted as `pending` and left there — nothing currently transitions a `pending` wallet_transactions row to `completed`/`failed` (🟠 partially implemented: the state exists, the forward transition doesn't).

`tips.status`: `pending | successful | failed | cancelled | refunded`. Only `successful` is ever actually written (`create_tip` either succeeds and inserts `successful`, or raises an exception and inserts nothing) — `pending`/`failed`/`cancelled`/`refunded` are schema-ready but unused (`refunded` explicitly documented as not-yet-executable, see §K).

`driver_payouts.status`: `pending → processing → completed`, or `pending/processing → failed`. All transitions are admin-driven (`adminProcedure`), never automatic — no real bank-transfer callback exists to move a payout forward (see §L).

**Can a client directly set a payment to "successful"?** ✅ No. Every status-bearing table's write path is either a `security definer` function with its own authorization check (`add_wallet_transaction`, `create_tip`) or an `adminProcedure`-gated route (`driver_payouts` status). RLS alone never permits a client to flip a financial status column.

---

## G. RIDE/PAYMENT STATE MACHINE

This is the one area meaningfully hardened this session. Current, verified behavior:

- **Can a ride be completed without successful payment?** No — `rides_settle_trigger` rejects the transition to `status='completed'` unless `paymentStatus='paid'` is already true in the same statement, and `rides.confirmPayment` is the only path that legitimately sets `paymentStatus='paid'` for a wallet ride (it genuinely debits the wallet first; failure there means `paymentStatus` never flips).
- **Can payment succeed for a cancelled ride?** N/A in the online-payment sense (no online payment exists for ride fares yet) — but a cancellation fee, if any, is not gated by `paymentStatus` at all (see §K/§D) since it isn't collected through wallet/online payment.
- **Can a cancelled ride still credit driver earnings?** Yes, by design, if there's a chargeable cancellation fee (handled by the same trigger's second branch) — this is intentional (drivers should be compensated for a rider's late cancellation), not a bug.
- **Can a driver earn money before the ride is completed?** No — `platformCommissionAmount`/`driverEarningsAmount` are only ever written inside the settlement trigger's completed/cancelled branches.
- **What if payment succeeds but the ride is cancelled?** Not reachable for ride fares today (payment and completion are the same step, gated together). Relevant for wallet **top-ups** unrelated to a specific ride — a top-up succeeding is independent of any ride's lifecycle.
- **Driver cancels / rider cancels:** both route through the same `cancelled` status; cancellation-fee logic (client-computed in `lib/cancellation-calculator.ts`, written to the ride, then recomputed/locked by the same trigger) determines whether any money changes hands, and only wallet debit is wired for ride *payment* — cancellation fees are recorded but, per the audit above, not actually collected through any payment rail (🔵 business decision required: should cancellation fees debit the rider's wallet the same way ride fares now do?).
- **Provider timeout / webhook-arrives-late:** not applicable to ride fares (no webhook in that path); applicable to wallet top-ups, where the answer is "nothing happens until the client calls verify" — see §M.

**Double-completion / double-crediting:** ✅ closed — the trigger rejects any second attempt to move a ride into a terminal status, and rejects any direct tampering with the financial columns post-settlement, regardless of which client (rider or driver app) gets there first.

---

## H. COMMISSION MODEL

**10% platform / 90% driver**, implemented once, consistently, in two synchronized places:

- **Client-side estimate/reference implementation:** `calculateDriverPayout()` in `lib/fare-calculator.ts`, using `PLATFORM_COMMISSION_RATE` (`lib/pricing-config.ts`, currently `0.1`).
- **Server-side, authoritative:** `rides_settle_trigger()` recomputes the identical formula in SQL, now reading the rate from `platform_commission_config` (a real, admin-editable, single-row table) rather than a hardcoded constant — this closes the "two literals must be kept in sync" risk that existed earlier in this engagement. The client's `PLATFORM_COMMISSION_RATE` constant is now only a *display/estimate* value; the trigger's DB-read value is what actually gets persisted, and it **wins** regardless of what the client computed.

**Formula:** `commission = meteredFare × rate` where `meteredFare` excludes flat platform fees (`bookingFee`/`serviceFee`/`zoneFee`/`priorityFee` — these are 100% platform revenue, never commission-rate-multiplied, and not part of the "commissionable" base) and `waitingCharge` (100% driver, for the opposite reason). `driverEarnings = fare − commission` (i.e. driver receives the metered fare's 90% *plus* the full waiting charge *plus*, implicitly, any flat platform fees included in `fare` — see the rounding/formula-consistency note in §J).

**Tips are correctly excluded from commission entirely** — `create_tip()` never reads or writes `rides.fare` or any commission column; a tip is 100%-driver/0%-platform by construction (not a zero-rate calculation applied to a code path that could theoretically apply a rate), and this is covered by an automated regression test.

**🔵 Business decision still open:** should cancellation fees go through the same 90/10 split (current behavior) or be treated as pure driver compensation like waiting charges? Current code treats them as normal commissionable fare; this was a pre-existing design choice, not something changed this session, and is worth an explicit product decision rather than an assumption.

---

## I. DRIVER EARNINGS

Drivers receive earnings **only after** `rides_settle_trigger` fires on a `completed` (or fee-bearing `cancelled`) ride — never before, never speculatively. There is **no separate earnings-crediting step**: `platformCommissionAmount`/`driverEarningsAmount` are snapshot columns on the `rides` row itself, written once, immutable thereafter.

**🟠 Two divergent sources of "driver earnings" exist simultaneously:**
1. `drivers.earnings` (`jsonb`: `today/thisWeek/thisMonth/total`) — a precomputed blob on the driver's own row, shown on `app/driver-earnings.tsx`'s top summary card. No code path in the current codebase was found that actually *updates* this JSON blob at settlement time (it appears to be a legacy/vestigial field from an earlier architecture).
2. `DriverStats`/`DriverEarnings` (`lib/firebase-driver-service.ts:getDriverStats/getDriverEarnings`) — computed live, at read time, by summing `rides.driverEarningsAmount` (+ `tips.amount` since this session) bucketed by date. This is what the wallet screen, the rest of the earnings screen, and the payout-balance function all actually use.

These two can disagree (the `jsonb` blob is stale/unmaintained while the live aggregation is correct), and the UI currently shows **both** on the same screen (`app/driver-earnings.tsx`) without reconciling them — a driver could see two different "total earnings" figures on one screen. Recommend either wiring the `jsonb` blob to update from the same trigger (extra write, more state to keep consistent) or removing it in favor of the already-correct live aggregation everywhere (simpler, recommended).

**Duplicate-crediting protection:** ✅ the settlement trigger's terminal-state immutability guard is what actually prevents a ride from crediting a driver twice, independent of which client (or how many times) attempts to complete it.

---

## J. TIPS

**Implemented** (added this session). 100%-driver / 0%-platform, own transaction table (`tips`), own atomic write path (`create_tip()`, `security definer`, `service_role`-only), idempotent via a per-attempt idempotency key + advisory lock, server-side re-validation of ride ownership/status/payment/window regardless of what the client claims. Folded into the driver's withdrawable balance (`get_driver_available_balance`). Only wallet-method tips are supported (schema structured so a second method could be added without a rewrite; card-at-checkout doesn't exist to build on top of yet). Admin has a read-only tips list (`admin.payments.tips`) and a `totalTips` dashboard figure kept separate from platform revenue. Refund status exists in the schema but has no execution path (documented, not faked).

---

## K. REFUNDS

⚪ **NOT IMPLEMENTED.** No refund-initiating code exists anywhere — no Paystack/Flutterwave refund API call, no route, no admin action that reverses a wallet debit or a completed ride's commission. `wallet_transactions.type` includes `'refund'` and `tips.status` includes `'refunded'` as schema-level readiness, but nothing ever writes either. If a rider needs money back today, it would have to be done manually and out-of-band (e.g. an admin directly inserting a `wallet_transactions` row via the Supabase dashboard, which itself would bypass `add_wallet_transaction`'s safety checks — not a recommended workaround).

**🔵 Business decision required** before this can be built: full vs. partial refunds, whether a refund reverses the platform's commission proportionally or is absorbed entirely by one side, refund policy for cash vs. wallet vs. (eventually) card rides, and whether Paystack/Flutterwave's own refund APIs are used (provider-side refunds have their own settlement delay and fee implications) versus a purely internal wallet credit.

---

## L. PAYOUTS

🟡 **Partially implemented — request/validation/approval is real; actual money movement to a bank account is not.**

- Bank account storage: real, plaintext (`driver_bank_accounts`) — see §17 below for the security concern.
- Account verification: ⚪ not implemented — no call to a bank-account-name-resolution API; whatever the driver types is trusted at face value.
- Recipient creation / transfer initiation / transfer verification: ⚪ not implemented — no Paystack Transfers / Flutterwave Transfers API call exists anywhere.
- Payout status: 🟢 real, but purely a manual admin toggle (`pending/processing/completed/failed`), not driven by any provider callback.
- Idempotency: 🟢 the withdrawal-request insert is protected by a real, server-side, advisory-lock-guarded balance check (`driver_payouts_check_balance`) — two near-simultaneous requests from the same driver cannot together overdraw their balance.
- Minimum withdrawal: enforced client-side only (`app/(driver-tabs)/wallet.tsx`, ₦100/₦10 depending on screen — inconsistent, see §S) — no server-side minimum.
- Available vs. pending balance: 🟢 correct and server-authoritative (`get_driver_available_balance`, includes ride earnings + tips, subtracts pending/processing/completed payouts).

**In plain terms: a driver can request a withdrawal and the system will correctly refuse to let them overdraw, and an admin can mark it paid — but nothing actually sends the driver any money.** This is the single largest "UI implies a feature that doesn't fully exist" gap in the audit (🔵 confirm this is understood/acceptable for current operations, e.g. payouts are executed manually via bank transfer outside the app and the admin panel is just recording that fact after the transfer already happened elsewhere).

---

## M. WEBHOOKS

⚪ **No webhook endpoint exists anywhere in this codebase** — confirmed by searching the entire `backend/` tree for any route matching "webhook," and by the `notifications`/`payments` routers in `app-router.ts` containing no such entry.

Consequences:
- **Payment confirmation for wallet top-ups is entirely client-driven.** The rider (or a deep-link callback) must call `verify` after returning from checkout. If the app is killed, the network drops, or the rider simply never returns to the app after paying, Paystack/Flutterwave will have processed the charge but Pantra will have **no record of it at all** — not even a `pending` transaction, since nothing is written until verification succeeds.
- **Duplicate webhook handling is moot** (there's nothing to duplicate), but this also means **there is no automated safety net** if the client-driven verify flow is ever skipped or fails silently.
- **"Could someone call the webhook manually and mark a ride as paid?"** — not applicable (no webhook to call), but the equivalent risk exists in a different shape: `rides.confirmPayment` is gated by `driverProcedure` (must be a real authenticated driver who owns the ride), so it cannot be called by an arbitrary party — this specific risk is closed, just via a different mechanism than a webhook.

**Recommendation (documented, not built, per the scope of this audit):** add real Paystack/Flutterwave webhook receivers with signature verification as the authoritative confirmation path, with the current client-driven `verify` flow retained as a fallback/manual-recovery path rather than the sole mechanism. This is the single highest-leverage reliability improvement available and should be prioritized before Paystack is actually turned on in production (it currently isn't — see §E).

---

## N. DATABASE — FINANCIAL TABLES

| Table | Key fields | FK behavior | Deletable? |
|---|---|---|---|
| `rides` | id (PK), userId→users, driverId→drivers, fare/fees/commission columns, paymentStatus, status | `driverId references drivers("id")` — no explicit `ON DELETE` clause found, i.e. Postgres default `NO ACTION` (a driver row can't be deleted while referenced) | No admin delete route found; RLS has no delete policy for rides |
| `wallets` | userId (PK, →users **ON DELETE CASCADE**) | 🟠 — deleting a user cascades to deleting their wallet row entirely | — |
| `wallet_transactions` | id (PK), userId→users **ON DELETE CASCADE**, rideId→rides, reference (partial-unique for credit types) | 🔴 — deleting a user **cascades to deleting their entire transaction ledger**, destroying financial history | No app-level delete route found (good), but the schema-level cascade is a real risk if a user (or account) is ever deleted for any reason (GDPR-style erasure, admin cleanup, etc.) |
| `tips` | id (PK), rideId→rides, riderId→users, driverId→drivers | no explicit ON DELETE (defaults to NO ACTION/RESTRICT) | No delete route |
| `driver_payouts` | id (PK), driverId (text, matches drivers.id), bankAccountId→driver_bank_accounts **ON DELETE SET NULL** | losing the bank account record detaches it from historical payouts but doesn't delete the payout row itself — acceptable | No delete route |
| `platform_commission_config`, `pricing_tier_config`, etc. | single-row/config tables | n/a | Admin can only update, not delete (confirmed no delete route on commission config) |

**🔴 Flag: `wallet_transactions."userId" references public.users("uid") on delete cascade`.** This is the one place in the schema where a financial ledger can be silently, permanently destroyed as a side effect of an unrelated operation (deleting a user account). For a financial system, transaction records should survive account deletion (anonymize the user reference if needed for privacy compliance, but never cascade-delete the ledger itself). This should be changed to `ON DELETE RESTRICT` (block user deletion while transactions exist) or `ON DELETE SET NULL` with the ledger row itself preserved.

---

## O. SECURITY

Findings, most severe first:

- 🔴 **`rides.fare` (and other pre-settlement columns) are client-writable** via the broad `"Rider or driver can update ride"` RLS policy, with no independent server-side recomputation against distance/duration/tier before the settlement trigger trusts it as input (§D). This is the most significant open financial-integrity gap.
- 🔴 **Bank account numbers stored in plaintext** (`driver_bank_accounts.accountNumber`, `wallet_bank_accounts.accountNumber`), no `pgcrypto`/encryption, protected only by RLS (i.e. by application-layer access control, not by encryption at rest — anyone with the service-role key or raw DB/backup access can read every driver's bank account number in cleartext).
- 🟠 **No environment separation** — a single flat `.env` drives development, preview, and production EAS build profiles alike for Supabase project, Paystack/Flutterwave keys, and API base URL. `APP_ENV` is set per build profile in `eas.json` but nothing in the codebase reads it. Risk: a production build could accidentally ship with test credentials, or vice versa, with no code-level safeguard against it.
- 🟢 No secret ever appears in client-bundled code or logs (verified directly — `EXPO_PUBLIC_*` variables are all genuinely public-safe; `PAYSTACK_SECRET_KEY`/`FLUTTERWAVE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY` only appear server-side, and only provider response bodies get logged on failure, never the keys themselves).
- 🟢 No card PAN/CVV/PIN/BVN/NIN is stored anywhere (one client-side form field transiently holds a typed CVV for a currently-non-functional "add card" screen that never transmits or persists it).
- 🟢 Payment status, commission, driver earnings, and wallet balance are all computed/written server-side (trigger or `security definer` function) — none of these can be set directly by an authenticated client to an arbitrary value.

---

## P. CONCURRENCY

- ✅ **Wallet credits/debits**: `add_wallet_transaction` row-locks the wallet (`for update`) inside one function call — two simultaneous debits/credits for the same user serialize correctly and an overdraft is impossible.
- ✅ **Tips**: `create_tip` takes a `pg_advisory_xact_lock` keyed to `(riderId, idempotencyKey)` *before* checking idempotency, closing the specific race where two near-simultaneous identical requests could both pass the idempotency check before either commits.
- ✅ **Driver payouts**: `driver_payouts_check_balance` takes an advisory lock keyed to `driverId` before computing available balance, so two concurrent withdrawal requests from the same driver can't together exceed their balance.
- ✅ **Ride completion**: the settlement trigger's terminal-state check means a ride can only ever be settled once, regardless of how many clients race to complete it.
- 🟠 **Wallet top-up verification**: no explicit lock, but protected by the partial unique index on `(reference)` for credit-type transactions plus a catch-and-return-existing-row pattern in `add_wallet_transaction` — safe against duplicate credits, though (unlike tips/payouts) it relies on a unique-constraint race rather than an advisory lock taken up front. Functionally safe, structurally slightly less defensive than the newer tips/payouts pattern.
- ⚪ **Refunds**: not applicable — no refund code exists to have a race condition in.

No unprotected double-credit/double-debit path was found anywhere in the currently-implemented financial write paths.

---

## Q. ACCOUNTING / LEDGER

**Model:** Pantra uses **a hybrid** — a genuine append-only ledger for the rider wallet (`wallet_transactions`, `tips`), but a **derived, not-materialized** ledger for driver earnings (computed at read time from `rides` snapshot columns, never written to a dedicated `driver_earnings` transaction table) and a **simple, non-transactional balance field** for `drivers.earnings` (the stale `jsonb` blob noted in §I).

**Is a full ledger warranted?** 🔵 **Right-sized as-is for the rider wallet; the driver-earnings side is the inconsistent part.** Recommend: either (a) accept the current design — `rides`/`tips` rows already function as an effectively-immutable, append-only record of driver earnings, since the settlement trigger makes them unmodifiable after the fact, so a separate `driver_earnings_ledger` table would be largely redundant — or (b) if a unified ledger view across ride earnings + tips + payouts is wanted for reporting/reconciliation, add a *read-side* view/materialized view that unions `rides` (settled), `tips` (successful), and `driver_payouts`, rather than a new write path. Do **not** introduce a full double-entry banking ledger (debit/credit pairs, balance-before/balance-after on every row) — that is meaningfully more architecture than a ride-hailing platform at Pantra's current scale needs, and the existing wallet ledger already demonstrates the simpler pattern (`amount` + running `balance`) is sufficient and working.

---

## R. RECONCILIATION

⚪ **No reconciliation capability exists.** No code, script, or admin feature calls Paystack's or Flutterwave's transaction-list/settlement endpoints, and nothing compares Pantra's internal `wallet_transactions` against either provider's own records. Every payment record Pantra has originates from a client-triggered `verify` call against a specific, already-known reference — there is no process that could ever discover "Paystack processed a charge Pantra never recorded." This is a direct consequence of §M (no webhook) and is worth prioritizing alongside it: even a simple weekly admin-triggered job that pulls each provider's transaction list for a date range and diffs it against `wallet_transactions.reference` would close most of the exposure.

---

## S. TESTING

236 tests currently pass across 16 files. Payment-relevant coverage:

| Area | Covered? |
|---|---|
| Fare calculation (incl. rounding order, min-fare-before-surge) | ✅ `testing/unit/fare-calculator.test.ts` |
| Commission math (90/10 split, fractional-kobo not truncated) | ✅ same file |
| Payment verification (incl. the Flutterwave outer-vs-inner status bug, regression-tested) | ✅ `testing/unit/payment-providers.test.ts` |
| Tips (amount bounds, window, zero-commission) | ✅ `testing/unit/tip-config.test.ts` |
| Driver earnings snapshot / commission-at-settlement | ✅ `testing/integration/driver-service.test.ts` |
| Payment initialization | ⚪ no test |
| Webhook handling | ⚪ n/a (nothing to test) |
| Refunds | ⚪ n/a (nothing to test) |
| Wallet crediting (`payments.wallet.credit`) | ⚪ no dedicated test |
| Concurrency / duplicate-request scenarios | ⚪ no test exists for any payment/payout/wallet path — all the concurrency protections in §P are correct by code inspection, none are exercised by an automated concurrent test |
| Admin financial routes | ⚪ no test |

**Recommended additions**, roughly in priority order: (1) an integration-style test against a real/local Postgres for `create_tip`/`add_wallet_transaction`/`rides_settle_trigger`'s actual SQL behavior (currently only verifiable manually — this environment has no DB test harness, which is itself worth fixing), (2) a concurrency test firing two simultaneous identical `create_tip`/withdrawal requests and asserting exactly one side effect, (3) a `payments.wallet.credit` unit test mocking the provider verify call, (4) a security test asserting a plain `authenticated` role cannot call `add_wallet_transaction` with `type='add_money'` or `create_tip` at all.

---

## STATUS CLASSIFICATION

| Feature | Status |
|---|---|
| Rider wallet (balance, ledger, debit/credit) | 🟢 IMPLEMENTED & SAFE |
| Wallet top-up (Paystack/Flutterwave) | 🟡 IMPLEMENTED BUT NEEDS IMPROVEMENT (no webhook; Paystack not actually configured) |
| Ride payment (wallet method) | 🟢 IMPLEMENTED & SAFE |
| Ride payment (cash) | 🟡 IMPLEMENTED BUT NEEDS IMPROVEMENT (trusted on driver's word, no independent confirmation) |
| Ride payment (card, at checkout) | ⚪ NOT IMPLEMENTED |
| Ride/payment state coupling | 🟢 IMPLEMENTED & SAFE |
| Commission (10/90) | 🟢 IMPLEMENTED & SAFE |
| Commission rate admin-configurability | 🟢 IMPLEMENTED & SAFE |
| Fare integrity (client-writable pre-settlement) | 🔴 UNSAFE / SECURITY RISK |
| Driver earnings (live aggregation) | 🟢 IMPLEMENTED & SAFE |
| Driver earnings (`drivers.earnings` jsonb) | 🟠 PARTIALLY IMPLEMENTED (stale/unmaintained, shown alongside the correct figure) |
| Tips | 🟢 IMPLEMENTED & SAFE |
| Driver payouts — request/validation/approval | 🟢 IMPLEMENTED & SAFE |
| Driver payouts — actual bank transfer | ⚪ NOT IMPLEMENTED |
| Refunds | ⚪ NOT IMPLEMENTED |
| Webhooks | ⚪ NOT IMPLEMENTED |
| Reconciliation | ⚪ NOT IMPLEMENTED |
| Bank account data security | 🔴 UNSAFE / SECURITY RISK (plaintext at rest) |
| Environment separation | 🟠 PARTIALLY IMPLEMENTED (mechanism exists in `eas.json`, unused) |
| Secrets handling | 🟢 IMPLEMENTED & SAFE |
| Money representation / rounding | 🟡 IMPLEMENTED BUT NEEDS IMPROVEMENT |
| Admin financial controls | 🟢 IMPLEMENTED & SAFE (view + policy-edit only, no individual-record editing, properly gated) |
| Concurrency protection | 🟢 IMPLEMENTED & SAFE |
| Test coverage | 🟡 IMPLEMENTED BUT NEEDS IMPROVEMENT |

---

## PRIORITY MATRIX

**P0 — Critical**
1. `rides.fare`/fee columns are client-writable pre-settlement with no independent server-side recomputation (§D, §O).
2. Bank account numbers stored in plaintext, no encryption at rest (§17, §O).
3. `wallet_transactions` cascade-deletes with the user row (§N) — a financial ledger must never be capable of silent destruction.

**P1 — High (required before scaling production payment volume)**
4. No webhook-based payment confirmation — single point of failure is the client (§M).
5. No reconciliation capability against Paystack/Flutterwave (§R).
6. No environment separation for payment credentials across dev/preview/production (§O).
7. Commission/earnings math is unrounded floating point; add explicit rounding + `numeric(12,2)` scale (§C, §E).

**P2 — Medium**
8. `drivers.earnings` jsonb blob is stale and shown alongside the correct live figure — reconcile or remove (§I).
9. Driver payouts have no real bank-transfer execution (§L) — confirm this is intentionally manual today.
10. Cash-ride payment confirmation is trust-based with no independent verification (§B, §G).
11. Concurrency and payment-integration test coverage gaps (§S).

**P3 — Low**
12. Minimum-withdrawal amount inconsistently enforced across screens, client-side only.
13. No dedicated admin "Tips" filterable list page (stat card only) — already a known, accepted limitation.
14. `points_transactions.amount` typed `integer` while every currency column is `numeric` — inconsistent but low-risk (loyalty points, not currency).

---

## PROPOSED TARGET ARCHITECTURE (recommendations, not yet built)

- Move ride-lifecycle fare writes behind a backend route that independently recomputes `fare` from `distance`/`duration`/tier before accepting a client's proposed value, closing the P0 fare-trust gap without discarding the existing client-estimate/server-settle pattern that already works well for commission.
- Add Paystack/Flutterwave webhook receivers with signature verification as the primary payment-confirmation path; keep the current client-driven `verify` as a manual-recovery fallback.
- Add a scheduled or on-demand reconciliation job/admin action comparing provider transaction lists against `wallet_transactions`.
- Encrypt `driver_bank_accounts.accountNumber`/`wallet_bank_accounts.accountNumber` at the column level (pgcrypto or application-layer envelope encryption), or mask to last-4 for any display path and store the rest only where a real payout-provider integration needs it.
- Change `wallet_transactions."userId"` FK to `ON DELETE RESTRICT` (or preserve the row with a nulled/anonymized reference) — never cascade.
- Introduce real environment-keyed credential loading (separate `.env` per EAS build profile, or a secrets manager), gated on the already-present-but-unused `APP_ENV`.
- Round `commission`/`driverEarnings` to 2dp at computation (both in `lib/fare-calculator.ts` and `rides_settle_trigger`), and add explicit `numeric(12,2)` scale to every currency column.
- Build refund execution (provider-API-backed for online payments, internal reversal-transaction-backed for wallet) once the business rules in §K are decided.
- Build real payout execution (Paystack/Flutterwave Transfers API) once §L's manual-vs-automated question is resolved.

None of the above should be started until this report is reviewed and the 🔵 business decisions are resolved.

---

## CURRENT STATE

A working rider wallet, a working (and, since this session, genuinely payment-gated) ride-settlement pipeline, a working tips feature, and a working driver-payout request/approval flow, sitting alongside two real payment-provider integrations that are only connected to wallet top-up, no webhooks, no refund execution, no real bank-transfer execution, and a still-open fare-integrity gap that predates and survives all of the above.

## WHAT IS CORRECT

The wallet ledger's atomicity and overdraft protection; the ride-settlement trigger's payment gate, server-side commission computation, and settlement immutability; tips' idempotency and commission exclusion; driver-payout balance validation and RLS; admin's read-only-plus-policy-only financial access model; secrets handling; absence of any stored card/BVN/NIN/CVV/PIN data.

## WHAT IS WRONG

Client-writable `fare` pre-settlement; plaintext bank account storage; cascade-deleting the wallet ledger; unrounded commission/earnings math; no environment separation for payment credentials; a stale, divergent driver-earnings display field.

## WHAT IS MISSING

Webhooks; reconciliation; refund execution; real payout/bank-transfer execution; card payment at ride checkout; concurrency and payment-integration test coverage.

## BUSINESS DECISIONS REQUIRED

- Full kobo-integer migration vs. rounding fix on the current Naira-numeric model (§C).
- Whether cancellation fees should be collected through the wallet (like ride fares now are) or remain uncollected/manual (§G).
- Whether cancellation fees should be commissionable like ride fares, or driver-only like waiting charges (§H).
- Refund policy: full/partial, who absorbs the commission on a refund, provider-API-backed vs. internal reversal (§K).
- Payout execution: build real bank-transfer integration, or formally keep payouts as an admin-recorded manual process (§L).
- Paystack activation: populate real production credentials, or launch with Flutterwave only (§E).

## PROPOSED TARGET ARCHITECTURE

See dedicated section above.

## DATABASE CHANGES REQUIRED

See "Proposed Target Architecture" — FK behavior fix on `wallet_transactions`, encryption/masking on bank account columns, explicit `numeric(12,2)` scale on currency columns, rounding at computation time.

## API CHANGES REQUIRED

A fare-verification backend route (replacing trust in client-supplied `fare` pre-settlement); webhook receivers for both providers; a reconciliation endpoint/job; refund and real-payout execution routes, once business decisions are made.

## PAYMENT PROVIDER CHANGES REQUIRED

Real Paystack production credentials (or a decision not to launch it); webhook configuration in both providers' dashboards pointing at new receiver endpoints; Transfers API integration for real payouts, if that path is chosen.

## SECURITY CHANGES REQUIRED

Close the fare-trust gap; encrypt/mask bank account numbers; fix the wallet-ledger cascade-delete; add environment-separated credentials.

## TESTING REQUIRED

Concurrency tests for wallet/tip/payout write paths; a `payments.wallet.credit` unit test; webhook-payload tests once webhooks exist; a DB-backed integration test harness for the trigger/RPC-level logic currently only manually verifiable.

## IMPLEMENTATION PLAN

Phase 1 (P0): fare-trust fix, bank-data encryption, wallet-ledger FK fix.
Phase 2 (P1): webhooks + reconciliation, environment separation, rounding/scale fix.
Phase 3 (P2): earnings-field consolidation, payout execution (pending business decision), cash-payment confirmation improvement, test coverage expansion.
Phase 4 (P3): minor consistency cleanups.

No implementation should begin until this report is reviewed.
