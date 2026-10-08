# Pantra Ride App — Dev Log & Project Status

## Project Overview

**App:** Pantra Ride App  
**Platform:** Android / iOS / Web (Expo React Native)  
**Market:** Nigeria (NGN pricing, Flutterwave payments)  
**Purpose:** Two-sided rideshare marketplace — riders book trips, drivers fulfil them. Includes an admin panel for operations management.  
**GitHub:** https://github.com/Shenum1/Pantra-ride-app  
**Branch:** `main`

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81.5, Expo 54, Expo Router 6 |
| Language | TypeScript 5.9.2 |
| State | Zustand 5.0.2 |
| Auth & DB | Supabase (PostgreSQL + RLS) |
| Real-time | Supabase Realtime |
| Maps | Google Maps API |
| Payments | Flutterwave (Paystack code kept, not configured) |
| Backend API | tRPC 11.5 + React Query 5.90 |
| Notifications | Expo Notifications |
| Location | expo-location (foreground + background) |
| Testing | Vitest + Playwright |

---

## Feature Status

_Last reviewed 2026-10-06. ✅ working · 🔄 partial / not yet verified end to end · ❌ removed_

### Accounts

| Feature | Status | Notes |
|---|---|---|
| Rider signup & login | ✅ | Email + password, with email verification (`app/verify-email.tsx`). |
| Google sign-in | ✅ | Native and web. Google accounts must add a phone number before booking (`app/collect-phone.tsx`). |
| Phone (SMS) login | ❌ | Removed 2026-08-27, replaced by Google sign-in + phone collection. |
| Driver signup & login | ✅ | An existing rider can also become a driver on the same account. |
| Driver verification | ✅ | Two-step wizard (credentials, vehicle) + documents → automated checks → admin approval in admin-web. |
| Route protection | ✅ | `AuthGuard` on rider and driver tabs. |

### Rides

| Feature | Status | Notes |
|---|---|---|
| Booking & fares | ✅ | Fare is calculated on the server and locked — the app can't change it. Covers booking/service/zone/waiting/cancellation/priority fees, surge and fare negotiation. |
| Book for someone else | ✅ | |
| Scheduled rides | ✅ | |
| Ride matching | ✅ | Online drivers see nearby pending rides and accept one. |
| Live tracking & messaging | 🔄 | Supabase realtime (Firebase is no longer used). **Not working on production (2026-10-08 snapshot):** chat tables have no read rules, and no table is published to realtime, so no live updates arrive. Fixed by pending migrations `chat_read_access` and `realtime_publication`. |
| Ratings | ✅ | |
| GPS (rider & driver) | 🔄 | Works; still needs confirming on real devices. |

### Money

| Feature | Status | Notes |
|---|---|---|
| Payment provider | 🔄 | **Flutterwave only** (test mode). Paystack code is kept but not configured. Every payment is tracked (payment intents + signed webhooks + reconciliation). |
| Rider wallet | ✅ | Top up by card, then pay rides and tips from it. No withdrawals. Receipts can be downloaded/shared. |
| Ride payment | ✅ | **Wallet or cash.** Cards are only used to top up the wallet, never charged per ride. |
| Tips | ✅ | Paid from the wallet; 100% goes to the driver. |
| Commission | ✅ | 90% driver / 10% Pantra, fixed on each ride when it settles. Rate is editable in admin and only affects later rides. |
| Cash-ride commission | ✅ | On cash rides drivers owe Pantra its share. Above a limit they can't accept cash rides. Admin records payments on the Commission page. |
| Driver payouts | 🔄 | Automatic Flutterwave transfers are built but **blocked by Flutterwave IP whitelisting**, so payouts are paid manually: admin pays outside Pantra, then marks it "Complete manually". Bank account numbers are encrypted. |
| Refunds | 🔄 | Admin-initiated, with eligibility checks and reconciliation (admin-web Refunds page). Not yet verified end to end. |
| Promotions | ✅ | |
| Rewards (Coin Dome) | 🔄 | Watch-an-ad rewards (mobile only) and tasks. |

### Admin & operations

| Feature | Status | Notes |
|---|---|---|
| Admin web panel | ✅ | `admin-web/` (own Vercel project): Overview, Riders, Drivers, Trips, Verification, Payments, Payouts, Refunds, Commission, Pricing, Promotions, Support, Content, Agent queue. The old in-app admin tabs were removed. |
| Support tickets | ✅ | Riders open tickets in the app; admins reply in admin-web. |
| AI admin agent API | ✅ | `/api/v1/agent-admin`. Read tools run immediately; write tools wait for an admin to approve them in the Agent queue. |
| Background videos | ✅ | Login/signup videos are managed from admin-web's Content page. |
| Push notifications | 🔄 | Remote push to drivers for new ride requests; rider trip updates are local notifications. |
| Maps, Discover, Weather | 🔄 | Google Places/Directions work, with a custom map style. Static Maps & Geocoding APIs may still need enabling in Google Cloud. |

### Platform

| Feature | Status | Notes |
|---|---|---|
| Hosting | ✅ | Web app + API on Vercel (Node 22). admin-web is a separate Vercel project. |
| Mobile builds & updates | ✅ | EAS Build (development / preview / production) and EAS Update. Runtime version = the app `version`, so **bump `version` in `app.json` after any native change**. |
| CI/CD | 🔄 | GitHub Actions: `ci.yml` and `admin-web-ci.yml` run on every PR; EAS update/build/submit are run manually. GitHub secrets, environments and branch protection still need confirming in GitHub. |
| Environment variables | ✅ | Local `.env`; `EXPO_PUBLIC_*` values also stored in EAS (keep the two in sync); server secrets in Vercel. |
| Database migrations | 🔄 | Supabase CLI migrations in `supabase/migrations/`, starting from a snapshot of production (2026-10-08). Tested on a local Docker database; CI checks they apply from scratch. How-to: `supabase/README.md`. `database/schemas/` is history only. Pending: mark the baseline as applied on production. |

### Known open issues

- **Review existing admin accounts.** The users role lockdown IS on production (confirmed 2026-10-08), so users can no longer make themselves admin. Still to do: run the review query at the bottom of `supabase-schema-users-role-lockdown.sql` to check nobody did before the fix.
- **Wave 1 is not on production yet.** Production has every SQL file up to 2026-10-05 and none of the 2026-10-07 ones. They're now migrations; release steps are in `supabase/README.md`.
- **Chat and live updates don't work on production** (see Live tracking & messaging above). Fixed by two pending migrations that go out with wave 1.
- **Secrets that don't belong in EAS.** `FLUTTERWAVE_SECRET_KEY` (preview) and `SUPABASE_SERVICE_ROLE_KEY` (production) are server-only and should be removed from EAS.

---

## Activity Log

> Entries from 2026-08-01 to 2026-10-06 were written on 2026-10-06 from the git history (the log had not been updated since 2026-07-31). Commit hashes are listed so details can be checked with `git show <hash>`.

### 2026-10-08 — Rewards points locked down (pending: apply migration, ship backend)

- **The problem.** Any signed-in user could write their own points rows (any amount, any type) or delete their history, and the app did exactly that for video/share task rewards, trusting the phone for the amount and the already-claimed check. Separately, the balance view ignored row rules and was readable by anyone holding the public anon key: every user ID with its points balance.
- **The fix.** Migration `20261008000800_points_lockdown.sql`: app sessions can only read their own points rows; the balance view applies the caller's row rules and is closed to anon; task rewards go through `claim_reward_task()`, callable only by the backend, which takes the amount from `reward_tasks` and enforces active / valid-until / per-user / total limits under a row lock. New route `rewards.claimTask`; the app calls it instead of inserting. Tested against a local database as each role.
- **Video watch time.** Migration `20261008000900_task_watch_timer.sql`: the app tells the server when a rider starts a video (`rewards.startTask`), and `claim_reward_task` refuses the claim until the required time (`minWatchSeconds`, default 120) has passed on the server clock. Starting again never resets it; a repeatable task needs a fresh start. It is a time gate, not proof of watching, and share tasks have no equivalent.
- **Not changed.** The server cannot see what is on the rider's screen or confirm an app was shared; only limits, amounts and a minimum wait are enforced. Spending points on a ride is unsupported (no server code applies points to a fare; the old client-side redemption is rejected by the database). The Earn tab still says points are "ride credit" — product decision pending.
- **Release order.** Deploy the backend (new route) first, then apply the migration; old app builds will fail to claim task rewards after it (ad rewards are unaffected).

### 2026-10-08 — Database migrations tracked in git

Schema changes now go through the Supabase CLI instead of the SQL editor (`supabase/README.md`).

- **Production snapshot.** Linked the repo to the Pantra Ride project and dumped production's schema (read-only, structure only). Compared against every file in `database/schemas/`: production has every file up to 2026-10-05, including the users role lockdown, and none of the five 2026-10-07 wave 1 files. Superseded function versions and policies matched the later files that replaced them, so nothing unexpected was found.
- **Baseline.** `supabase/migrations/20261008000000_baseline.sql` = that snapshot, plus Pantra's signup trigger and driver-document storage policies. Rebuilt locally from scratch, it reproduces production exactly.
- **Wave 1 as migrations:** security hardening, backend hardening, policy acceptances, rider privacy. The plaintext bank-number drop is held back until the encryption backfill has run.
- **Two new migrations** for problems the snapshot showed: production has no read rules on `conversations`/`messages` (chat can't load), and its realtime publication contains no tables (the app's live subscriptions to rides, drivers and chat never receive anything).
- **Checks.** All migrations + `supabase/seed.sql` apply to a fresh local database. After applying them, every wave 1 file fully matches. `supabase db lint` reports no errors. New CI workflow `.github/workflows/db-migrations.yml` repeats this on PRs that touch `supabase/`.
- Supabase CLI 2.120.0 added as a dev dependency (`bunx supabase`). Local database needs Docker Desktop.

### 2026-10-07 — Wave 1 merged: security fixes, receipts, terms records, privacy controls

Built by four agents on separate branches, reviewed, and merged into `main` (merge commits up to `cbb8e22`). All 676 unit + integration tests pass; `tsc` clean. **Nothing below has been run against the real database or tried on a device yet.**

- **Database access (security items 1–3):** riders can no longer read the `drivers` table directly. Nearby drivers come from `get_nearby_drivers` and the assigned driver from `get_ride_driver` (phone only during the ride). Only verified drivers see pending rides, through `get_pending_rides_for_driver`, with no rider name/phone/photo until they accept via `accept_ride`, which is atomic so two drivers can't claim the same ride. Messages: participants only, recipient can only mark read. Rider map now polls driver location every 4 s.
- **Backend (security items 4–6):** `notifyDrivers` requires the ride owner; `/api/google-maps` requires login and only forwards the endpoints the app uses. Rider bank numbers encrypted; payouts no longer fall back to the plaintext driver account number. New `admin_access_log` records admin views of bank details and rider/driver personal data.
- **To-do #10 and #15:** ride receipts (`app/ride-receipt.tsx`, PDF + share) for riders and drivers. Versioned terms acceptance stored server-side in `policy_acceptances`, Google signup now requires the checkbox, and a blocking prompt asks for re-acceptance when `constants/legal-versions.ts` changes. Every existing user will see the prompt once.
- **To-do #8:** Google UMP ad consent before any ad loads; personalised ads only when the toggle is on (off by default); iOS tracking prompt only when a rider turns personalised ads on. Location Sharing off = the app never reads the rider's GPS. Profile photo hidden from drivers when Profile Visibility is off. "Data Collection" toggle removed (nothing to control). New dependency `expo-tracking-transparency` → **needs `bun install` and a new native build.**
- **Interim:** the fake "Download My Data" / "Delete All My Data" buttons are replaced with "Request My Data or Account Deletion", which opens support (real flows come with to-do #5–6).

**Run in Supabase, in this order** (all re-runnable):
1. `supabase-schema-users-role-lockdown.sql` (still pending from 2026-10-06)
2. `supabase-schema-security-hardening.sql` — **release the matching app build at the same time**; older builds lose the driver map, ride requests and accept.
3. `supabase-schema-backend-hardening.sql`
4. Run `bun scripts/backfill-bank-account-encryption.ts --dry-run`, then without `--dry-run` (needs `EXPO_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BANK_ACCOUNT_ENCRYPTION_KEY` — same key as production). Continue only if it exits 0.
5. Deploy the backend.
6. Back up, then `supabase-schema-bank-accounts-drop-plaintext.sql` (refuses if any row is still unencrypted).
7. `supabase-schema-policy-acceptances.sql`
8. `supabase-schema-rider-privacy.sql`

**Owner to-do from this wave:** restrict the Google Maps API key to the Pantra app/website in Google Cloud console (it's embedded in the app), and publish a consent message in AdMob → Privacy & messaging (otherwise Google shows no consent form).

### 2026-10-06 — To do today: features the legal documents assume

The new legal drafts in `docs/legal/` describe these features as working. Today they are missing, placeholders, or only half built. Each one must be finished (or the matching clause removed) before the documents are published.

| # | Feature | What happens today | Evidence |
|---|---|---|---|
| 1 | Cancellation fees | ₦200 / ₦500 is recorded on the ride but never charged to the rider or paid to the driver. The driver app still shows it as earnings. | `lib/cancellation-calculator.ts`, `supabase-schema-platform-commission-config.sql:93-96`, `lib/firebase-driver-service.ts:445-448` |
| 2 | Reward points at checkout | Points are deducted and a lower "You will pay" is shown, but the server fare is not reduced. | `app/ride-checkout.tsx:36-68` |
| 3 | Emergency (SOS) call | Shows "Calling 911..." and calls nobody. Should dial 112 (Nigeria). | `app/safety.tsx:66-75` |
| 4 | Trusted contacts, trip sharing, Safety Center | Placeholder pop-ups; the toggles are saved but do nothing. | `app/safety.tsx:77-82` |
| 5 | Delete account | "Delete All My Data" shows a success message and deletes nothing. No deletion flow exists anywhere. | `app/privacy.tsx:76-83`, `supabase-schema-fk-deletion-hardening.sql:9-13` |
| 6 | Download my data | Message only. | `app/privacy.tsx:64-73` |
| 7 | Rider change password | Says "updated successfully" without changing it. | `app/login-security.tsx:70-84` |
| 8 | Privacy toggles | Location sharing, data collection, personalised ads and profile visibility are saved but nothing reads them. AdMob has no consent prompt or non-personalised mode. | `app/privacy.tsx`, `components/AdBanner.tsx`, `hooks/useRewardedAd.ts` |
| 9 | Communication preferences | Toggles are not saved. | `app/communication-preferences.tsx:53-56` |
| 10 | Ride receipts | No ride receipt in the app; no email receipts at all (only wallet-transaction receipts exist). | `app/expense-rides.tsx:77`, `lib/transaction-receipt.ts` |
| 11 | Suspend rider / driver accounts | No suspension. Drivers can only be REJECTED; riders can't be restricted. | `backend/services/admin/driver-verification.ts` |
| 12 | Document expiry dates | Expiry checks exist but the app never collects expiry dates, so they never fire. | `lib/driver-verification-state-machine.ts:140-157` |
| 13 | Lost property | No way to report it. Add a "Lost item" support ticket category and a driver-side flow. | `supabase-schema-support-tickets.sql` |
| 14 | Background location | Declared in `app.json` but not implemented. Either implement it for drivers or remove the declaration. Also remove the unused microphone permission. | `app.json:29-77`, `lib/location-tracking-service.ts:27` |
| 15 | Recording terms acceptance | Only a local flag on the phone, with no version. Needs a server record (user, policy, version, time). Google signup skips the checkbox. | `hooks/useTermsStore.ts:25-27`, `app/signup.tsx:166-173` |
| 16 | Policy links | The About screen's legal links are placeholders; driver screens have no policy links; the in-app Terms/Privacy text must be replaced with `docs/legal/`. | `app/about.tsx:44-58`, `app/terms-and-conditions.tsx`, `app/privacy-policy.tsx` |
| 17 | Shared rides | Only a 20% discount; riders are never actually matched together. | `backend/trpc/routes/rides/create/route.ts:174-177`, `app/share-ride.tsx` |
| 18 | Booking / zone / priority fees | Code comments say these are Pantra revenue, but the driver's earnings = full fare − commission, so the driver keeps them. Decide and fix one or the other. | `supabase-schema-cash-commission-ledger.sql:158` |

**Security issues found during the same audit** (fix before launch):
- Anyone, even logged out, can read every column of `drivers` (email, phone, live location, date of birth, licence number, VIN, push token): `supabase-schema.sql:97-98`.
- Any account with a `drivers` row, verified or not, can read all pending rides including passenger name and phone: `supabase-schema-driver-pending-rides.sql`.
- `messages` allows any update, and `messages`/`conversations` allow any insert: `supabase-schema.sql:184-204`.
- `notifications.notifyDrivers` and `/api/google-maps` need no login: `backend/trpc/routes/notifications/notify-drivers/route.ts:6`, `backend/hono.ts:24`.
- Rider bank account numbers are stored in plaintext (`wallet_bank_accounts`), and the old plaintext `driver_bank_accounts.accountNumber` column is still there.
- Admin viewing of bank details and personal data is not logged.

### 2026-10-06 — Security fix: users could make themselves admin

- **Problem:** admin access is decided by the `user_roles` table, and three paths let any user put an `admin` row there for themselves:
  1. Updating their own `users.role` to `admin` (the profile update rule doesn't restrict columns), which the `sync_user_roles` trigger copied into `user_roles`.
  2. Inserting their profile row with `role = 'admin'` (the signup insert rule accepted anything).
  3. Signing up with `role: 'admin'` in the signup metadata, which `handle_new_user` copied into `users.role`.
- **Fix:** new migration `supabase-schema-users-role-lockdown.sql`:
  - `sync_user_roles` only syncs `rider`/`driver` — `users.role` can never grant admin.
  - Requests from the app can only set `role` to `rider` or `driver` (the Google driver signup's `rider` → `driver` change still works).
  - `handle_new_user` ignores any signup role other than `rider`/`driver`.
  - A user can only insert their own profile row.
- **Making someone admin now** (Supabase SQL editor only — the app can't):
  ```sql
  update users set role = 'admin' where email = '<email>';
  insert into user_roles ("userId", role) select uid, 'admin' from users where email = '<email>';
  ```
  Both are needed: admin-web's login screen checks `users.role`, the backend checks `user_roles`.
- Rider → driver switching is unaffected (become-driver runs on the backend; app signups may still set `rider`/`driver`).
- **Action required:** run the migration in Supabase, then run the admin-review query at the bottom of the file and remove any admin you don't recognise.

---

### 2026-10-06 — Payments survive the app being closed during checkout

- Android often closes the app in the background while the Flutterwave checkout is open, and the payment screen's progress was lost.
- The app now saves the pending checkout before opening it (`lib/pending-checkout.ts`) and finishes confirming it on the next launch (`components/PendingCheckoutResumer.tsx`).

Commit: `501cefa`

---

### 2026-10-05 — AI admin agent API with human approval

- New API at `/api/v1/agent-admin` (`backend/agent-admin/`) so an AI agent can help with admin work.
- Read tools run immediately. Write tools (support replies, driver verification, payouts, pricing, promotions, app videos) are only **queued** — an admin must approve each one on admin-web's new **Agent queue** page. The agent cannot approve its own actions.
- Admin logic moved into shared services (`backend/services/admin/*`) used by both admin-web and the agent.
- Needs `AGENT_ADMIN_SECRET_KEY` — set only in the Vercel main-app project.

Commit: `c2074ac`

---

### 2026-10-05 — Phone number required before booking

- Google sign-ins never collected a phone number, so drivers couldn't call the rider at pickup. Booking now stops and asks for one (`app/collect-phone.tsx`).

Commit: `0e0fc55`

---

### 2026-10-04 — EAS updates weren't reaching phones (fixed)

- **Problem:** updates published from GitHub Actions never showed up in the app.
- **Cause:** the workflow ran `eas update` without `--environment`, and the CI runner has no `.env`. The update was built without the Supabase URL and API base URL, so the app crashed on launch and expo-updates silently fell back to the version built into the APK.
- **Fix:** `.github/workflows/eas-update.yml` now passes `--environment <channel>`, and a correct update was republished to `preview`.
- **Rules from now on:**
  - Publish with `eas update --branch <channel> --environment <channel>`.
  - When adding an `EXPO_PUBLIC_*` variable to `.env`, add it to EAS too (`eas env:create`).
  - After a native change (new native package or plugin, permissions, Expo SDK upgrade), bump `version` in `app.json` and make a new build.
  - After publishing, fully close and reopen the app twice (first launch downloads, second applies).

Commit: `243e460`

---

### 2026-10-04 — Rider wallet: withdrawals removed and balance locked down

- Riders can no longer withdraw to a bank account; the withdraw and bank-account screens were removed. (The old flow never actually sent money.)
- **Security fix:** riders could previously change their own wallet balance. Every balance change now goes through `add_wallet_transaction`, and a rider's own session can only *debit*.
- Migration: `supabase-schema-rider-wallet-lockdown.sql` — must be run in Supabase.

Commit: `0f12ffc`

---

### 2026-10-04 — Web Google sign-in, receipts, map and nav polish

- Google sign-in on web (`app/auth-callback.tsx`) — `78be985`
- Wallet transaction receipts can be downloaded and shared (`lib/transaction-receipt.ts`) — `cfd7c9d`
- Rating display formatting, custom map style, bottom tab bar tweaks — `8793149`, `aed10e5`

---

### 2026-10-02 — Flutterwave becomes the only payment provider; cash-ride commission

- **Flutterwave** now handles wallet top-ups and driver payouts (`backend/lib/flutterwave-checkout.ts`, `backend/lib/flutterwave-payout-provider.ts`). Paystack code is kept but not configured.
- **Card-free rides:** saved cards and the "add payment method" screen were removed. Rides are paid by wallet or cash; cards are only used to top up the wallet.
- **Cash-ride commission:** on cash rides the driver keeps the whole fare, so they owe Pantra its commission. A ledger tracks what each driver owes; drivers over the limit can't accept cash rides. Admins record payments on the new **Commission** page (`backend/lib/cash-commission.ts`).
- **Payouts:** Flutterwave transfers are blocked by IP whitelisting on the Flutterwave account, so all payouts go to the manual-review queue (admin pays outside Pantra, then "Complete manually").

Commit: `865524b`

---

### 2026-10-01 — Support tickets, "become a driver", driver tab clean-up

- Riders can open and follow support tickets in the app (`app/my-tickets.tsx`, `app/ticket-detail.tsx`); admins reply in admin-web.
- A rider can register as a driver from their existing account (`become-driver` route) and goes through the normal verification wizard. Roles now live in a `user_roles` table so one account can hold several.
- Driver tabs, profile, achievements and goals screens simplified.

Commit: `41989ae` (`77c7c26` / `0e99806` were a temporary location-error debug change, since reverted)

---

### 2026-09-28 — Map style and navigation bar

- Custom Google map style (`constants/map-style.ts`) and a redesigned rider tab bar.

Commit: `94ac4d0`

---

### 2026-09-22 → 2026-09-24 — Login, verification and role selection

- Rider email verification screen (`app/verify-email.tsx`) — `5ece2e0`
- Driver verification wizard cut to two steps: credentials and vehicle (`app/driver-verification/`) — `50b74ec`, `b7be84f`
- Driver signup fixes, including a leftover-session bug that made new signups fail database permission checks — `2154d57`, `4cc3d70`
- Role-selection screen redesigned ("Welcome to Pantra" → Rider / Driver) — `c7c856e`

---

### 2026-09-21 — Refunds and admin password reset

- Refund system: an admin checks eligibility and issues the refund; refunds have their own records and reconciliation (`backend/lib/refund-processor.ts`, admin-web **Refunds** page).
- admin-web "forgot password" / reset-password pages.
- Lint config fixed for the Node scripts in `scripts/`.

Commit: `a0ba650`

---

### 2026-09-16 — Driver payouts: automatic and manual

- Drivers request payouts through a backend route (`driver/payouts/request`) instead of writing to the database directly.
- A payout is either sent automatically by provider transfer or handled by an admin (move to manual review, complete manually, mark failed, retry). Includes payout reconciliation and a Nigerian bank list.
- Migration: `supabase-schema-driver-payouts-automation.sql`

Commit: `61353d8`

---

### 2026-09-15 — Payment audit: every payment is tracked

- Each top-up is tracked from start to finish (`payment_intents`, `payment_events`).
- Paystack/Flutterwave webhooks added, with signature checks; repeated webhooks are ignored, so nothing is credited twice.
- Admin reconciliation finds mismatches between Pantra and the provider and flags them for review — it never moves money on its own.
- A finished or cancelled ride's status can no longer be changed (closed a double-payout bug).
- Migrations: payment intents, payment events, payment reconciliation, rides terminal-status lock, fare source, drivers earnings legacy lock.

Commit: `1a52517`

---

### 2026-09-11 — Financial audit: fares and money locked down

- Fares are calculated on the server when a ride is created (`backend/trpc/routes/rides/create`) and can't be changed by the app afterwards.
- All money amounts use exact two-decimal values (`NUMERIC(12,2)`) with consistent rounding.
- Driver bank account numbers are encrypted (AES-256-GCM); an admin reveals one only when paying. Existing rows: `scripts/backfill-bank-account-encryption.mjs`.
- Safer deletion rules between related tables.
- Full write-up: `docs/PAYMENT_FINANCIAL_ARCHITECTURE_AUDIT.md`

Commit: `6de706a`

---

### 2026-09-10 — Admin-editable background videos

- Background videos on the welcome, login and signup screens are managed from admin-web's **Content** page (`app_video_config` table) — `d37f411`
- Android `versionCode` bumped to 10 — `8f55b64`

---

### 2026-09-03 — In-app admin removed; verification and rewards tweaks

- In-app admin tabs deleted — **admin-web is now the only admin tool** — `657861b`
- Driver verification no longer requires phone verification (email still required) — `7c984e2`
- Ad rewards section renamed **Coin Dome**; on web it says "available in the mobile app" — `56d6382`

---

### 2026-08-27 — Google sign-in, Vercel deployment fixes, admin-web restyle

- Google sign-in added (native). Phone-OTP login removed and replaced by a phone-collection screen — `f734619`
- Vercel deployment fixed: Node pinned to 22.x; `api/index.ts` loads `expo-server`'s CommonJS build because its ESM build fails on Vercel; admin-web given its own Vercel config — `bbc5a44`, `e32a00f`, `9256c93`, `5c2bd60`, `1a8e343`
- admin-web restyled with shared components (tables, filters, modals, status labels) — `1446dc5`

---

### 2026-08-26 — admin-web redesign; CI/CD workflows

- admin-web rebuilt with new pages: Overview, Drivers, Riders, Trips, Payments, Pricing, Promotions, Support — all wired to backend routes.
- GitHub Actions added: `ci.yml` (typecheck, lint, tests, Expo check, secret scan), `admin-web-ci.yml`, and manual `eas-update` / `eas-build` / `eas-submit` workflows.

Commit: `1d6c7d5`

---

### 2026-08-24 — Tips; mock data removed

- Riders can tip a driver from their wallet after a ride (`app/tip-driver.tsx`). Tips go 100% to the driver and show in driver earnings — `912a2a6`, `896ef4e`
- Remaining mock data and the old standalone admin prototype (`admin/`) removed — see `docs/PRODUCTION_MOCK_DATA_AUDIT.md` — `912a2a6`

---

### 2026-08-23 — Driver verification v2, password reset, ad rewards

One large commit (`118aebb`):

- New driver verification: multi-step wizard, document upload, automated checks (OCR / authenticity providers in `backend/services/verification/`), and admin decision screens.
- Forgot-password flow.
- Watch-an-ad rewards (AdMob).
- A ride can only be completed once its payment is confirmed (`rides/confirm-payment`), and commission is saved on each ride when it settles.
- Rider account details and privacy preferences saved to Supabase.

---

### 2026-08-12 — Skeleton loading and OTA updates

- Skeleton loading states across most screens; fixed duplicate family members; removed dollar-sign icons (the app is NGN-only); EAS Update (OTA) configured.

Commit: `725e520`

---

### 2026-08-06 — Book for someone else; vehicle images

- Riders can book a ride for another person; vehicle images per ride type; EAS build profiles set up.

Commit: `bb12862`

---

### 2026-08-01 → 2026-08-02 — Pricing pipeline and payment methods

- Pricing moved into one pipeline (`lib/fare-calculator.ts`): booking/service fees, zone fees, waiting charges, cancellation fees, surge and fare negotiation, plus an admin fare breakdown and unit tests — `8426ec6`, `ee631f3`
- Payment methods stored in Supabase instead of mock data — `8ebc445`
- Removed the fake default 5.0 rating new drivers were given — `4a3a40d`
- Empty-state and ride-store loading fixes; mock data removed from driver documents — `5035c6c`, `7d1d1e3`, `1a29fa9`

---

### 2026-07-31 — Web responsive shell; RLS was silently blocking drivers from ever seeing pending rides

**Why (responsive shell):** User reported the web version "doesn't adapt properly" — every screen stretched full-bleed edge-to-edge on wide desktop browsers, since the app was built mobile-first with zero responsive layout handling anywhere in the codebase (confirmed via a full audit: no `Container`/`Screen` wrapper, no breakpoints, no `useWindowDimensions`-based layout logic across ~84 screen files). Chose the low-risk "centered app shell" approach (like Instagram/X/WhatsApp Web) over a full desktop redesign (sidebar nav + per-screen multi-column layouts) — same mobile layout everywhere, just not stretched.

**What changed:**
- New `components/ResponsiveShell.tsx` — no-ops completely on native (`Platform.OS !== 'web'`); on web, centers content in a `maxWidth: 560` column with a theme-aware (`useTheme()`) frame background/border.
- `app/_layout.tsx` — wrapped `RootLayoutNav()`'s `<Stack>` + `<Toast />` in `<ResponsiveShell>`. Since every screen and all three tab groups `(tabs)`/`(driver-tabs)`/`(admin-tabs)` nest inside that one root `Stack`, this single wrap point covers the entire app with no other files touched.

**Status:** Code complete, `tsc --noEmit` clean (14 pre-existing unrelated errors only). Not yet visually verified in a browser.

---

**Why (driver never sees pending rides):** Continued debugging the ride-booking flow after the fixes in the entry below. Rider's booking succeeded and the driver *did* receive the Expo push notification for the new ride request (proving `notifyDrivers` and the ride insert both worked) — but opening the driver app never showed the ride on the "Available Rides" / Trips list.

Two things were tried/checked first, in order:
1. Two client-side hypotheses were checked and ruled out via user confirmation: location permission was granted, and driver/rider were in the same area, so the 10km `distanceToPickup` filter in `lib/firebase-driver-service.ts` wasn't the cause.
2. `hooks/useDriverStore.ts` — added an `AppState` listener that refetches pending ride requests (`loadDriverData`) whenever the app returns to `'active'`, on the theory that realtime subscriptions get dropped while backgrounded (a real gap worth having regardless, but it didn't fix this particular bug).

**Root cause:** Found in `database/schemas/supabase-schema.sql` — the *only* `select` RLS policy on `public.rides` is:
```sql
create policy "Rider can read own rides"
  on public.rides for select using (
    auth.uid() = "userId" or
    auth.uid() in (select "userId" from public.drivers where "id" = "driverId")
  );
```
This only allows the rider who created a ride, or a driver **already assigned** to it (`driverId` set), to read the row. A `pending` ride has `driverId = NULL` — so no driver could *ever* see any pending ride, for any reason. RLS filters this out silently (no error surfaced anywhere), so `getPendingRideRequests()`/`subscribeToRideRequests()` always returned zero rows for drivers regardless of location, distance, or any client-side logic — this was never fixable from the app side.

**Fixed:** New additive migration `database/schemas/supabase-schema-driver-pending-rides.sql` — adds a policy allowing any authenticated driver to `select` rides where `status = 'pending'`. Postgres OR's multiple `select` policies together, so this adds to (doesn't replace) the existing rider/assigned-driver policy.

**Action required (user):** run `supabase-schema-driver-pending-rides.sql` in Supabase Dashboard → SQL Editor.

**Status:** Migration file written, not yet run/verified by the user. Once run, re-test the original repro (book while driver app is backgrounded → push arrives → open app → ride should now appear).

---

### 2026-07-31 — API routes were never actually enabled; fixed real-device ride booking crash + Supabase Node.js SSR crash

**Why:** Booking a ride from a physical device hit `Uncaught Error: Unexpected token '<', "<!DOCTYPE "... is not valid JSON` from tRPC's `httpLink`. That's the signature of a client expecting JSON but receiving an HTML page — the request never reached an API handler.

**Root cause:** Confirmed directly from Expo's CLI source (`node_modules/@expo/cli/build/src/start/server/metro/router.js` / `MetroBundlerDevServer.js`): **Expo Router API routes require `web.output: "server"` in `app.json`, even during local dev** — not just for production export, which is what the 2026-07-29 entry below assumed when adding `app/api/[...path]+api.ts`. `app.json`'s `web` block had no `output` field, so every `/api/*` request had been silently falling through to the app's HTML shell the whole time that route existed.

**Fixed:**
- `app.json` — added `"output": "server"` to the `web` block.
- `hooks/useRideStore.ts` — the driver-notification push call after a successful ride insert was fire-and-forget with no `.catch()` (`void trpcClient.notifications.notifyDrivers.mutate({...})`), so its failure surfaced as a scary unhandled-rejection error even though the ride itself was already created successfully. Added `.catch()` to log instead of throw.

**New crash surfaced by the above fix:** enabling `web.output: "server"` made Expo Router evaluate the app's module graph in real Node.js (to build the route table), which now executes `lib/supabase.ts` at import time in Node — triggering `Server Error: Node.js 20 detected without native WebSocket support`. `@supabase/supabase-js` eagerly constructs a `RealtimeClient` in `createClient()` regardless of whether realtime is used, and Node <22 has no native `WebSocket` global, so it throws unless a `transport` is supplied.
- `lib/supabase.ts` — pass a local no-op `NoopSocketTransport` class as `realtime.transport`, but only when `typeof window === 'undefined'` (Node/SSR only — never used in the browser or native app, and never actually opens a connection in that context, since SSR never subscribes to anything).
- `backend/lib/supabase-admin.ts` — same fix, applied unconditionally (this client only ever runs server-side). This one was a **live** bug, not just an SSR-time one: every admin route (`admin.users`, `admin.rides`, `admin.payouts.*`, etc.) would have hit this same crash on every real request, since `supabaseAdmin` is constructed eagerly at module import.

Neither fix pulls in the `ws` package (Supabase's own suggested fix) — a plain inline stub class satisfies `RealtimeClientOptions.transport`'s type without risking a Metro bundling failure from trying to bundle a Node-only package for native/web-client targets.

**Status:** `tsc --noEmit` clean on all four changed files (only pre-existing unrelated `admin-web` `import.meta.env` typing errors remain, not from this change). Not yet re-verified end-to-end after restart — needs a full dev server restart (`app.json` changes aren't picked up by hot reload), then re-test: rider booking a ride from a physical device, `admin-web`'s Users/Rides/Payouts/Verification pages, and the Discover tab's real Google Places results (same underlying `/api/*` dead-end likely affected all of these).

---

### 2026-07-30 — Removed hardcoded Discover mock places now that the Google Maps key is live

**Why:** `app/(tabs)/discover.tsx` fell back to a 20-entry hardcoded `mockPlaces` array (fake Abuja venues) whenever the real Google Places API returned zero results or errored. Now that a real `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is configured, this fallback is no longer needed and was masking whether the real integration actually works.

**What changed:**
- `app/(tabs)/discover.tsx` — deleted the `mockPlaces` array and its two fallback call sites (zero-results branch and the catch block); both now just set an empty list instead. Also removed the now-dead `phone?: string` field from the `Place` interface (only ever populated by the removed mock data — real Google results never set it).

**Separately diagnosed (no code fix needed — external config):** while investigating why the on-web map wasn't rendering, found via direct API testing that the configured Google Maps key has **Places API** and **Directions API** enabled, but **Maps Static API** and **Geocoding API** return `403 This API is not activated on your API project`. Maps Static API is what `components/Map.tsx` uses to render the map on web (`react-native-maps` doesn't support web, so it falls back to a static image); Geocoding API feeds the weather widget's city name lookup. Both need to be enabled in Google Cloud Console → APIs & Services → Library for the same project the key belongs to.

**Status:** Mock data removal is code-complete and typechecked clean. Static map / geocoding still blocked on enabling those two APIs (user action, not code).

---

### 2026-07-29 — Admin web panel (Vite), payment callback screen, admin payouts/rides routes committed

**Why:** These files existed locally (uncommitted) from earlier work but were never logged or pushed — discovered while restoring a downloaded copy of the repo as a proper git clone. Committed as `e24a0c6`.

**What changed:**
- **`admin-web/`** — a standalone admin web app (Vite + React + TypeScript + Tailwind + `react-router-dom`, package name `pantra-admin-web`), connecting directly to Supabase (`admin-web/src/lib/supabase.ts`) for auth (`useAuth.ts`) and calling the Expo backend's tRPC HTTP endpoint directly via `fetch` (`admin-web/src/lib/api.ts`, not the `@trpc/client` package) for admin data. Pages: `Login`, `Dashboard`, `Users`, `Verification`, `Rides`, `Payouts`, wrapped in `RequireAuth` + `Layout`.
  - **Note:** `docs/ADMIN_WEB_PANEL_SPEC.md` (2026-06-18) specced this as a **Next.js** app; what's actually here is **Vite**, not Next.js. Worth confirming this was an intentional deviation.
- **`app/payment-callback.tsx`** — new Expo Router screen that verifies a Flutterwave transaction (`FlutterwaveService.verifyTransaction(txRef)`) after redirect, credits the rider's wallet via `useWallet().addMoneyAsync` when `purpose === 'wallet_funding'`, and shows a verifying/success/failed state before routing back to `/wallet` or `/(tabs)/home`.
- **`backend/trpc/routes/admin/payouts/list/route.ts`** and **`.../update-status/route.ts`** — new `adminProcedure` routes: `list` paginates `driver_payouts` (optional status filter) joined with driver name/email and bank account details; `updateStatus` transitions a payout to `processing`/`completed`/`failed` (stamping `completedAt`, optional `failureReason`).
- **`backend/trpc/routes/admin/rides/route.ts`** — new `adminProcedure` route paginating the `rides` table (optional status filter), joined with rider/driver display names.

**Fixed:** `backend/trpc/app-router.ts` didn't register these new routes under `admin`. Checked `admin-web/src/pages/Rides.tsx` (calls `trpcQuery('admin.rides', ...)` — a direct query, not `admin.rides.list`) and `Payouts.tsx` (calls `admin.payouts.list` / `admin.payouts.updateStatus`), then wired the router to match exactly:
```ts
admin: createTRPCRouter({
  // ...existing
  rides: adminRidesRoute,
  payouts: createTRPCRouter({ list: adminPayoutsListRoute, updateStatus: adminPayoutsUpdateStatusRoute }),
}),
```

**Status:** Router wiring complete, confirmed via `tsc --noEmit` (see 2026-07-29 entry below — root `node_modules` is now installed). Still pending: confirm Vite-vs-Next.js was an intentional deviation from the spec, and manually test the admin-web Payouts/Rides pages + payment-callback flow end-to-end.

---

### 2026-07-29 — Dropped Rork tunnel dependency; auto-detected API base URL; fixed broken admin route imports

**Why:** The project's only way to run its backend (`backend/hono.ts`) was `bunx rork start -p <id> --tunnel`, which mounts the Hono app and exposes it via a Rork-hosted public tunnel URL (`*.rork.app`). That tunnel is only live while someone's `rork start` process is actively running — it had gone stale (404s on every route), breaking `admin-web`'s Users/Rides/Payouts/Verification pages. Separately, running `npm install` (instead of `bun install`) failed outright with an ERESOLVE peer-dependency conflict from `@rork-ai/toolkit-sdk`'s nested dependency tree.

**What changed:**
- New `app/api/[...path]+api.ts` — a catch-all Expo Router API route that mounts the existing `backend/hono.ts` app at `/api` via `new Hono().route("/api", backendApp)` (the mounting pattern `hono.ts`'s own comment already anticipated: `// app will be mounted at /api`). This means a plain `expo start` now serves `/api/trpc/*` and `/api/google-maps` directly from the dev server — no Rork CLI, account, or tunnel required.
- `lib/trpc.ts` — `getBaseUrl()` no longer requires manually editing `.env` every time you switch between local web dev and phone/LAN testing. New priority order: (1) web → `window.location.origin`; (2) native dev (Expo Go/dev client) → `Constants.expoConfig.hostUri`, which Expo sets automatically to the bundler's actual LAN/tunnel address; (3) native production build (no dev bundler) → falls back to the explicit `EXPO_PUBLIC_RORK_API_BASE_URL`/`extra.rorkApiBaseUrl` env value.
- `scripts/start-expo-web.mjs` / `scripts/start-expo-phone.mjs` — removed the hardcoded `.cmd` extension on the Windows `expo` binary path. `bun install` generates `expo.exe`/`expo.bunx` in `node_modules/.bin`, not npm's `.cmd` shim, so the hardcoded path broke when deps were installed via Bun (which is required here — see ERESOLVE note above). Dropping the extension lets Windows' `PATHEXT` resolution find whichever one actually exists.
- **Bug fix (found via `tsc --noEmit` after finally getting root `node_modules` installed):** `backend/trpc/routes/admin/rides/route.ts` and both `admin/payouts/{list,update-status}/route.ts` (from the 2026-07-29 commit above) each had one extra `../` in their `create-context` import, e.g. `"../../../../../create-context"` instead of the correct `"../../../../create-context"` — `TS2307: Cannot find module`. These would have 500'd at runtime even with the router correctly wired. Fixed to match the depth used by sibling routes (`admin/users`, `admin/overview`, etc.).

**Action required (user):** dependencies must be installed with `bun install`, not `npm install` (the ERESOLVE conflict above). Local dev now runs via `npm run dev` (web, localhost) or `npm run phone` (LAN, for Expo Go) — the old `npm run start`/`start-web` scripts (`bunx rork start ... --tunnel`) are no longer needed for local development.

**Status:** Code complete, `tsc --noEmit` clean for all changed/new files (only pre-existing unrelated errors remain: `Map.tsx` static marker overlay styles, `firebase/auth` test-file type errors, `admin-web`'s `import.meta.env` typing — none introduced by this change). Not yet verified end-to-end on a physical device via `npm run phone`.

---

### 2026-06-19 — Production prep: bundle ID, EAS build config, remote push notifications

**What changed:**

**app.json fixes (critical — must be done before first store submission):**
- App display name: `"Pantra Ride App"` → `"Pantra"`
- Deep-link scheme: `myapp` → `pantra`
- iOS bundle identifier: `app.rork.pantra-ride-app` → `com.pantra.rides`
- Android package name: `app.rork.pantra-ride-app` → `com.pantra.rides`
- Removed Rork's origin URL from `expo-router` plugin
- Notification plugin: pointed to existing `./assets/images/icon.png` (removed missing `./local/assets/` references), enabled `enableBackgroundRemoteNotifications: true`
- `UIBackgroundModes`: replaced `audio` with `remote-notification` (needed for APNs background push)
- Stripped 4 Android permissions that trigger Play Store review flags: `RECORD_AUDIO`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `android.permission.REQUEST_INSTALL_PACKAGES`, `android.permission.HIGH_SAMPLING_RATE_SENSORS`
- All permission strings updated to use the "Pantra" name
- `supportsTablet: false` (ride apps are phone-only; avoids iPad-specific review requirements)

**EAS build setup:**
- Created `eas.json` with three build profiles: `development` (APK + iOS simulator), `preview` (internal APK distribution), `production` (AAB for Play Store + signed IPA for App Store)
- `autoIncrement: true` on production so build numbers increment automatically

**Remote push notifications (critical production fix):**

Push notifications were local-only — they only fired if the app was in the foreground. Drivers would never receive ride requests when their phone was locked. Fixed:

- `lib/notification-service.ts` — rewrote to:
  - `registerRiderPushToken(userId)` — requests permission, gets Expo push token (using EAS `projectId` from `Constants`), saves to `users.pushToken` in Supabase
  - `registerDriverPushToken(driverId)` — same flow, saves to `drivers.pushToken`
  - Removed the dead `registerForPushNotifications` method that was never called
- `app/_layout.tsx` — added `PushTokenRegistrar` component (mounted inside both `AuthProvider` and `DriverAuthProvider`) that calls the appropriate registration method whenever a rider or driver session becomes active
- `database/schemas/supabase-schema-push-tokens.sql` — new migration: `ALTER TABLE users ADD COLUMN pushToken TEXT`, same for `drivers`, plus index on `(isOnline, pushToken)` for fast driver queries
- `backend/trpc/routes/notifications/notify-drivers/route.ts` — new server route: reads all online drivers with a push token from Supabase, batch-sends Expo push notifications (up to 100 per request) to all of them via `https://exp.host/--/api/v2/push/send`
- `backend/trpc/app-router.ts` — registered `notifications.notifyDrivers` route
- `hooks/useRideStore.ts` — after a successful Supabase ride insert, fires `trpcClient.notifications.notifyDrivers.mutate(...)` server-side so all online drivers receive a remote push even when the app is backgrounded or the screen is locked

**Action required (user):**
1. **Run migration** — Supabase Dashboard → SQL Editor → run `supabase-schema-push-tokens.sql`
2. **EAS init** — run `eas init` in the `expo/` directory to get a project ID from Expo, then run `eas build:configure` — this will write the `projectId` into `app.json` under `extra.eas`, which is needed for Expo push tokens to work in production builds

---

### 2026-06-19 — Removed Mapbox dead code

**What changed:**
- Deleted `lib/mapbox-service.ts` and `constants/mapbox.ts` — both files were unused dead code. No file in the app imported either of them.
- The app uses Google Maps exclusively (`lib/google-maps-service.ts`, `components/Map.tsx`). No Mapbox npm package was installed.
- Removed Mapbox from Tech Stack table, Feature Status table, Production env vars row, Pending Work item #5, and Earlier sessions list.

---

### 2026-06-19 — Driver wallet earnings fixed (stale JSONB → computed Supabase stats)

**What changed:**
- `app/(driver-tabs)/wallet.tsx` — period earnings (Today/Week/Month) now read from `stats.todayEarnings/weekEarnings/monthEarnings` (computed from Supabase `rides` table by `getDriverStats`) instead of `driverProfile.earnings.today/thisWeek/thisMonth` (a JSONB column on the `drivers` row that was set to `{today:0,...}` at signup and never updated)
- Recent Activity date/amount fix: `earningsHistory` items have `payoutDate` and `createdAt`, not `date` — dates are now read correctly; amount now shows `netAmount` (80% of fare) instead of gross fare
- Withdrawal available balance: the "Available Balance" in the withdraw modal and the max-withdrawal guard now use `stats.totalEarnings - completedPayoutsTotal` (lifetime net earnings minus already-paid payouts) instead of the currently-selected period's earnings
- No schema changes, no new files — `getDriverEarnings` and `getDriverStats` in `lib/firebase-driver-service.ts` were already querying Supabase correctly; only the display layer was reading the wrong source

---

### 2026-06-18 — Admin web panel spec created

**What changed:**
- Produced a complete technical handoff document for a colleague to build the standalone admin web panel: `docs/ADMIN_WEB_PANEL_SPEC.md`
- The admin web panel is a separate Next.js app (not part of this Expo project) that connects to the same Supabase project
- The in-app `(admin-tabs)` screens remain in the Expo app but will be superseded by the web panel

**Screens specified for the web panel:**
Dashboard, Rides Management, User Management (list + detail pages for riders and drivers), Driver Verification, Analytics & Reports (revenue charts, cancellation rate, CSV export), Driver Payouts, Promotions Management, Reward Tasks Management, Ratings Moderation, Notifications (placeholder), Support Tickets (placeholder), Settings

**What the colleague needs from you:**
- Supabase Project URL (`NEXT_PUBLIC_SUPABASE_URL`)
- Supabase anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- Supabase service role key (`SUPABASE_SERVICE_ROLE_KEY`)
- All are in Supabase Dashboard → Settings → API

---

### 2026-06-18 — Status checkpoint

**Status update:**
- `supabase-schema-promotions.sql` ✅ confirmed run by user
- `supabase-schema-rewards.sql` ✅ confirmed run by user
- YouTube task URL not yet provided — `reward_tasks` table has no rows; the "Earn Points" task list on `app/promotions.tsx` will show "No tasks available right now" until at least one row is inserted
- `git push` not yet run — commits are local only

**Working as-is (no migration dependency):**
- Promo code input UI, task-detail timer flow, ride-checkout points toggle, driver wallet stats — all code is live; they just need the DB tables to exist

---

### 2026-06-17 — Promotions backend + Points/Rewards system + Driver wallet stats

**What changed:**
- **Promo codes** (`hooks/usePromotionsStore.ts`): replaced in-memory mock with real Supabase
  validation against `promotions` table. `applyPromoCode()` is now async; checks expiry,
  max uses, and per-user reuse via `user_promo_uses`. `maxDiscountNGN` cap now enforced
  in `useRideStore` fare calculation. `app/enter-promo-code.tsx` updated to `await` the
  async call and removed `.isUsed` reference.
- **Points/Rewards system** (new): `database/schemas/supabase-schema-rewards.sql` creates
  `reward_tasks`, `user_task_completions`, `points_transactions` tables + `user_points_balance`
  view. `lib/rewards-service.ts` — full Supabase CRUD. `hooks/usePointsStore.ts` — Zustand
  store. `app/promotions.tsx` — now shows points balance + task list above promo-code section.
  `app/task-detail.tsx` — new screen with timer-based YouTube claim and social share flow.
  `app/ride-checkout.tsx` — "Use Points" toggle deducts points value from fare at booking.
  1 pt = ₦16 (500 pts = ₦8,000). Points expire 90 days after earned.
- **Driver wallet stats** (`app/(driver-tabs)/wallet.tsx`): stats grid now shows real
  `stats.totalRides` and calculated avg/trip from Supabase. Removed hardcoded fake values
  (8.5h, 23 trips, ₦15.02) and fake bonuses/tips rows from earnings breakdown.

**Action required (user):**
1. Supabase SQL Editor → run `supabase-schema-promotions.sql`
2. Supabase SQL Editor → run `supabase-schema-rewards.sql`
3. Add tasks via Supabase Dashboard → Table Editor → `reward_tasks` → Insert row

---

### 2026-06-17 — SQL migrations run; Twilio setup deferred

- `supabase-schema-scheduled-rides.sql` ✓ run — `rides.scheduled_for` column live
- `supabase-schema-driver-payouts.sql` ✓ run — `driver_bank_accounts` + `driver_payouts` tables live
- Twilio credentials not yet available — phone OTP remains non-functional until Supabase Auth → Providers → Phone is configured with Twilio Account SID, Auth Token, and Messaging Service SID

---

### 2026-06-17 — Phone login, Schedule a ride, Driver withdrawal implemented

**What changed:**
- **Phone login** (`hooks/useAuthStore.ts`, `app/phone-login.tsx`): replaced mock OTP
  (`123456`) with real Supabase `signInWithOtp` / `verifyOtp`. Numbers auto-formatted to
  E.164 (`+234XXXXXXXXXX`). `+234` prefix shown inline in the login UI. After verify,
  a `public.users` row is upserted so the profile loads correctly.
  _Needs Twilio configured in Supabase Dashboard → Auth → Providers → Phone before SMS
  will actually send._
- **Schedule a ride** (`app/schedule-ride.tsx`): full rewrite using
  `@react-native-community/datetimepicker` (newly installed). Connects to
  `useRideStore.scheduleRide(date)`. Schedules a local notification 30 min before the
  ride via `expo-notifications`. Migration `database/schemas/supabase-schema-scheduled-rides.sql`
  adds `scheduled_for TIMESTAMPTZ` column to `rides`.
- **Driver withdrawal** (`app/(driver-tabs)/wallet.tsx`, new `app/driver-add-bank.tsx`,
  new `lib/driver-wallet-service.ts`): replaced Alert stub with real Supabase-backed manual
  payout flow. Driver saves bank account(s) to `driver_bank_accounts`, submits a withdrawal
  request to `driver_payouts` (status = `pending`). Admin reviews and pays out manually.
  Migration `database/schemas/supabase-schema-driver-payouts.sql` creates both tables with RLS.

**Action required (user):**
1. Supabase Dashboard → Auth → Providers → Phone → Enable + add Twilio credentials
2. Supabase SQL Editor → run `supabase-schema-scheduled-rides.sql`
3. Supabase SQL Editor → run `supabase-schema-driver-payouts.sql`

---

### 2026-06-16 — Project folder restructured

**What changed:** Reorganised project root so related files sit together:
- `docs/` — all markdown docs (DEVLOG, API contracts, architecture notes)
- `database/schemas/` — all SQL migration files
- `admin/` — admin web panel source (`web/`) and server (`server.js`)
- `config/firebase/` — Firebase rule files (storage, firestore)
- `config/eas/` — EAS build profile
- Root config files (`app.json`, `tsconfig.json`, `package.json`, etc.) left in place
- Updated two broken import paths: `app/admin.tsx` → `../admin/app`; `admin/server.js`
  static-path strings `admin-web` → `admin/web`

---

### 2026-06-12 — Supabase setup fully complete: saved_locations migration run + admin role promoted

**Why:** The previous entry left two outstanding setup actions: run
`supabase-schema-saved-locations.sql` so Saved Places can sync to Supabase,
and promote `gabrielfanda8@gmail.com` to `role = 'admin'` so the admin panel
login works.

**Fix:** User ran both in the Supabase SQL Editor:
- `supabase-schema-saved-locations.sql` (creates `saved_locations` table +
  RLS policies)
- `update public.users set "role" = 'admin' where "email" = 'gabrielfanda8@gmail.com';`

Re-ran `scripts/verify-setup.mjs` plus an ad-hoc check of `saved_locations`:

```
PASS — wallets table (wallet migration): exists (5 rows)
PASS — ratings table (ratings migration): exists (0 rows)
PASS — driver_documents table (driver-documents migration): exists (0 rows)
PASS — "documents" storage bucket (private): found (public=false)
PASS — admin role for gabrielfanda8@gmail.com: role="admin"
PASS — saved_locations table: exists (0 rows)
```

**Status:** ✅ Done. All Supabase setup steps from the report's "Setup Steps
Required" section are now complete. Saved Places sync and the admin panel
login are both fully unblocked for real accounts.

### 2026-06-12 — Rider ride-status notifications + Saved places now sync to Supabase

**Why:** Drivers already got a local notification when a new ride request came
in (`NotificationService.notifyNewRideRequest`), but riders got nothing when
their driver was assigned, arrived, started the trip, or completed it — even
though `notifyDriverAssigned`/`notifyDriverArrived`/`notifyRideStarted`/
`notifyRideCompleted` already existed in `lib/notification-service.ts`, fully
implemented but never called. Separately, Saved Places (Home/Work/Favorites)
were stored only in AsyncStorage, so they didn't persist across
devices/reinstalls for logged-in riders.

**Fix:**
- `app/ride-progress.tsx` — wired the four existing rider notification methods
  into the live ride-tracking subscription: `notifyDriverAssigned` fires when
  a driver accepts the ride, `notifyDriverArrived` fires when the driver gets
  within 150m of pickup, `notifyRideStarted` fires when the ride flips to
  `in-progress`, and `notifyRideCompleted` fires (with the real fare) when the
  ride completes. All local notifications, same device-local pattern as the
  driver side — no new push-token/EAS infrastructure required.
- Added `supabase-schema-saved-locations.sql` (new `saved_locations` table +
  RLS policies, modeled on the wallet migration) and
  `lib/saved-locations-service.ts` (get/add/update/remove, preserving the
  existing home/work upsert behavior).
- `hooks/useSavedLocationsStore.ts` now follows the same `isSupabaseUser`
  pattern as `useWalletStore`: real accounts read/write the `saved_locations`
  table in Supabase; the `test-rider` account keeps its AsyncStorage + mock
  fallback.
- Added `scripts/verify-setup.mjs` — a read-only diagnostic checking the
  wallet/ratings/driver-documents migrations, the `documents` storage bucket,
  and an account's admin role. Ran it: the 3 prior migrations and the private
  `documents` bucket are confirmed in place, but **the admin role for
  `gabrielfanda8@gmail.com` is not yet set** (currently `role="rider"`).

**Status:** ✅ Done. `npx tsc --noEmit` clean — same pre-existing baseline
errors only (3 in `Map.tsx`, 8 in `testing/integration/*.test.ts`), none
related to this change. Still needs: run
`supabase-schema-saved-locations.sql` in the Supabase SQL Editor for saved
places to sync, and run
`update public.users set "role" = 'admin' where "email" = 'gabrielfanda8@gmail.com';`
to finish admin setup (see Pending Work #2).

### 2026-06-12 — Discover tab now shows real nearby places instead of mock data

**Why:** `app/(tabs)/discover.tsx` showed a hardcoded `mockPlaces` array (20
fake Abuja places with fixed distances, stock Unsplash photos, and made-up
phone/hours/price). The category filter just filtered this static array, and
tapping a place computed a **fake destination** by applying a small lat/lng
offset to the rider's current location — it never used a real place's
coordinates. The rider asked for actual restaurants (and other categories)
near their real location, with real details.

**Fix:**
- `lib/google-maps-service.ts` — added `getNearbyPlaces(type, location, radius?)`,
  which calls the Google Places **Nearby Search** API
  (`/place/nearbysearch/json?location=...&radius=...&type=...`) and normalizes
  results into a new exported `NearbyPlaceResult` (`id`, `name`, `address`
  from `vicinity`, `location`, `rating`, `priceLevel`, `types`,
  `photoReference`, `isOpenNow`). Also added `getPlacePhotoUrl(photoReference)`
  (Places Photo API, same direct-key-in-URL pattern as the existing
  `buildStaticMapUrl`) and a public `getDistanceLabel(origin, destination)`
  (wraps the existing Haversine `calculateDistance`, formats as `"850 m"` /
  `"3.2 km"`). Returns `[]` on no API key / error / zero results.
- `app/(tabs)/discover.tsx` — added a `CATEGORY_TO_GOOGLE_TYPE` map (e.g.
  `restaurants` → `restaurant`, `hotels` → `lodging`, `shopping` →
  `shopping_mall`, etc. for all 8 categories) and a `mapToPlace()` helper that
  turns each `NearbyPlaceResult` into the existing `Place` shape: real
  rating, real distance (Haversine from the rider's GPS to the place), a real
  Google Photos image (falling back to a category-specific Unsplash image if
  the place has no photo), `"Open now"`/`"Closed now"` from
  `opening_hours.open_now`, `'₦'`-repeated price level, and a Title-Cased
  description derived from the place's `types` (e.g. `"Restaurant"`,
  `"Shopping Mall"`). A new `useEffect` (keyed on `userLocation` and
  `selectedCategory`) fetches nearby places on load and whenever the category
  changes, with a loading spinner while empty. `selectedCategory` now defaults
  to `'restaurants'` (pre-selected) instead of `null`/"show all 20 mixed mock
  places", since Nearby Search requires one `type` per request; tapping a
  category chip switches the search type instead of toggling a mixed view.
  `mockPlaces` (filtered by category) remains as the fallback when the API has
  no key, errors, or returns zero results.
- `Place` gained an optional `location?: Location` field carrying the place's
  real coordinates. `handlePlacePress()` now uses `place.location` directly as
  the ride dropoff when present (real destination for real places); the old
  fake-offset calculation is preserved only as the fallback for `mockPlaces`
  entries, which have no `location`.

**Status:** Code complete. `tsc --noEmit` shows only the same pre-existing
unrelated errors (`Map.tsx` static marker overlay styles and firebase-related
test files) — no new type errors introduced.

---

### 2026-06-12 — Weather widget now shows real weather for the user's actual location

**Why:** The weather card on `home.tsx`/`discover.tsx` always called
`fetchWeather(userLocation)` with the rider's real GPS coordinates, but
`useWeatherStore.ts`'s `fetchWeatherFromAPI()` ignored the `location` argument
entirely — it picked a random city name from a hardcoded
`["Abuja", "Lagos", "Kano", "Port Harcourt", "Ibadan"]` list and returned
randomized temperature/humidity/wind/etc. So the weather shown never matched
where the user actually was.

**Fix:**
- `hooks/useWeatherStore.ts` — `fetchWeatherFromAPI()` now calls the free
  Open-Meteo forecast API (`api.open-meteo.com/v1/forecast`, no API key
  required) with the user's real `latitude`/`longitude` to get live
  temperature, humidity, wind speed, feels-like, and weather code (mapped to a
  human-readable description via a new `WEATHER_CODE_DESCRIPTIONS` table).
  Removed the old `getMockWeatherData()`/random-city generator.
- `lib/google-maps-service.ts` — added `GoogleMapsService.getCityName()`,
  which reverse-geocodes the location via the Google Geocoding API and
  extracts the `locality` (falling back to `administrative_area_level_2`/`_1`)
  from `address_components`, so the weather card's city name now matches where
  the user actually is. Falls back to `'Current Location'` if no Google Maps
  API key is configured or the request fails.
- If the weather/geocode fetch fails (e.g. offline), `fetchWeather()` sets
  `error` and `WeatherCard` shows "Weather unavailable" instead of fabricated
  data.

**Status:** Code complete. `tsc --noEmit` shows only the same pre-existing
unrelated errors (`Map.tsx` static marker overlay styles and firebase-related
test files) — no new type errors introduced.

---

### 2026-06-12 — Added rider → driver messaging on ride-progress + fixed chat timestamp rendering

**Why:** A complete messaging backend (`lib/messaging-service.ts` — Supabase
`conversations`/`messages` tables with realtime subscriptions) and a working
driver-side chat already existed (drivers message riders from
`driver-active-trip.tsx` → `driver-message.tsx`), but communication was
one-directional: the rider's active-ride screen (`ride-progress.tsx`) had no
way to start a conversation with the driver, even though the fully-built rider
chat screen (`messages.tsx`) was unreachable. Separately, both `messages.tsx`
and `driver-message.tsx` rendered message timestamps via
`item.timestamp.toDate()`, but the `Message` type only has
`createdAt?: string` (a Supabase ISO string, not a Firestore Timestamp), so
`item.timestamp` was always `undefined` and no timestamp was ever shown.

**Fix:**
- `app/ride-progress.tsx` — added a "Message" button to the expanded ride-info
  sheet (alongside "Call driver"/"Cancel ride", gated by
  `canMessageDriver = stage !== 'searching' && !!assignedDriver`). The new
  `handleMessageDriver()` mirrors the driver-side `handleMessage()` pattern:
  calls `MessagingService.createConversation({ userId, userName, userPhone,
  driverId, driverName, driverPhone, rideId })` (using `useAuth()` for the
  rider and `assignedDriver` for the driver), then `router.push('/messages',
  { conversationId, driverName, driverPhone })`.
- `app/messages.tsx` and `app/driver-message.tsx` — replaced
  `item.timestamp && item.timestamp.toDate().toLocaleTimeString(...)` with
  `item.createdAt && new Date(item.createdAt).toLocaleTimeString(...)` so
  message timestamps render correctly for both sides.
- Net effect: once a driver is assigned, riders and drivers can message each
  other in real time via the same conversation (shared `subscribeToMessages`),
  with timestamps now displaying on both ends.

**Out of scope:** A dedicated rider "Messages"/conversations-list tab — riders
already have 5 tabs, so messaging stays a contextual in-ride action, matching
the driver's existing in-trip "Message" button pattern.

**Status:** Code complete. `tsc --noEmit` shows only the same pre-existing
unrelated errors (`Map.tsx` static marker overlay styles and firebase-related
test files) — the `Message.timestamp` errors on `messages.tsx`/
`driver-message.tsx` are now resolved, and no new type errors introduced.

---

### 2026-06-12 — Fixed driver "online" status not shared between Dashboard and Trips (and unblocked driver location tracking)

**Why:** After a driver toggled "Online" on the Dashboard, the Trips tab still showed
"You are offline / Go online to receive ride requests". Root cause: two separate
context stores tracked the driver's online status — Dashboard's toggle updated
`useDriverAuthStore`'s `driver.isOnline`, while Trips read `useDriverStore().isOnline`,
which Dashboard's toggle never touched. As a direct consequence, the location-tracking
effects in `trips.tsx` (gated on `useDriverStore().isOnline`) never ran, so
`updateLocation()` was never called and `drivers.location` was never written while a
driver was "online".

**Fix:**
- `hooks/useDriverStore.ts` — `toggleOnlineStatus` now calls `setIsOnline(newStatus)`
  immediately after `FirebaseDriverService.setDriverOnlineStatus(...)` succeeds, so the
  shared store's `isOnline` flips optimistically regardless of Realtime config.
- `app/(driver-tabs)/dashboard.tsx` — the online toggle now reads `isOnline` and
  `toggleOnlineStatus` from `useDriverStore()` (the same singleton instance Trips
  reads, both mounted once in `app/_layout.tsx`) instead of `useDriverAuth()`. Removed
  the now-unused local `isOnline = driver?.isOnline || false`.
- Net effect: Dashboard and Trips now read/write one shared `isOnline` state, and
  Trips' `watchPositionAsync` effect (gated on the same `isOnline`) starts correctly
  when a driver goes online, so `updateLocation()` → `drivers.location` now actually
  updates as documented in the "GPS — driver" row below.

**Out of scope:** `app/driver-dashboard.tsx` (legacy/unreachable duplicate dashboard,
same pattern, not navigated to from anywhere) and `useDriverAuthStore.toggleOnlineStatus`
(left as-is, still part of that hook's public API).

**Status:** Code complete. `tsc --noEmit` shows only the same pre-existing unrelated
errors (driver-message/messages `Message.timestamp`, `Map.tsx` static marker overlay
styles, and firebase-related test files) — no new type errors introduced. Manual
verification (toggle online on Dashboard, confirm Trips updates and location starts
syncing) is part of Pending Work #1.

---

### 2026-06-11 — Replaced UI emoji with lucide-react-native icons; distinct ride-type icons

**Why:** User requested a more professional look — all user-facing emoji (task/category
icons, payment gateway icons, alert titles, info headings, star/checkmark glyphs) should
be replaced with the `lucide-react-native` icons already used throughout the app.
Console.log/warn/error emoji were left untouched (debug-only). Separately, the
Standard/Comfort/XL ride-type selector showed the same generic `Car` icon for every
tier and needed visually distinct icons.

**Fix:**
- `app/(tabs)/earn.tsx` — task category chips (`📋🎬📱💬👥`) now render `ClipboardList`/`Film`/`Smartphone`/`MessageCircle`/`Users`; stripped emoji from the "Congratulations!"/"Success!" `Alert.alert` titles.
- `mocks/earnTasks.ts` — `icon` field changed from emoji to semantic keys (`video`, `social`, `check`, `survey`, `referral`, `app`, `music`, `star`); new `components/EarnTaskIcon.tsx` maps these to lucide icons (`Video`/`Camera`/`CheckCircle`/`ClipboardList`/`Users`/`Smartphone`/`Music`/`Star`), used in `app/(tabs)/earn.tsx` (available + completed task lists) and `app/earn-history.tsx`.
- `app/payment-gateway-select.tsx` — gateway icons (`💳🦋💵`) now `CreditCard`/`Wallet`/`Banknote`; "💡 Payment Gateway Setup" heading now an icon row with `Lightbulb`.
- `hooks/useWeatherStore.ts` — removed the dead emoji `icon` field (never read by `WeatherCard`, which derives its icon from `description`).
- `app/(driver-tabs)/dashboard.tsx` / `app/(driver-tabs)/trips.tsx` — stripped trailing decorative emoji from motivational quotes, the driver greeting, the weekly-goal subtext, and "Bonus Spin!".
- `app/add-payment-method.tsx`, `app/privacy-policy.tsx`, `app/terms-and-conditions.tsx` — emoji-prefixed info/section headings (💡📝📧🔒✅) now icon rows using `Lightbulb`/`FileText`/`Mail`/`Lock`/`CheckCircle`.
- `app/driver-achievements.tsx`, `app/(driver-tabs)/profile.tsx` — `✓ Earned` and the theme-selected `✓` indicator now render `CheckCircle`/`Check`.
- `app/driver-goals.tsx`, `components/RideProgressBottomSheet.tsx` — `★` rating glyphs now render a filled `Star` icon; `components/Map.tsx` — stripped `⭐` from a native map-marker description (can't host components).
- `mocks/rideTypes.ts` — Standard/Comfort/XL now have distinct `icon` keys (`car`/`car-front`/`bus`); `app/ride-confirmation.tsx` and `components/RideTypeSelector.tsx` map these to `Car`/`CarFront`/`Bus` via a small lookup instead of always showing `Car`.

**Status:** Code complete. `tsc --noEmit` shows only the same pre-existing unrelated errors (driver-message/messages `Message.timestamp`, `Map.tsx` static marker overlay styles, and firebase-related test files) — no new type errors introduced.

---

### 2026-06-11 — Fixed driver signup "Email not confirmed" / Supabase email rate limit

**Why:** Repeated test driver signups during development hit Supabase's shared/default
email-sending service rate limit (a low quota, intended for testing only). With
"Confirm email" enabled in Authentication > Providers > Email, the confirmation email
for the test account never arrived, so `signInWithPassword` rejected the account with
"Email not confirmed" even though the row already existed in `auth.users`.

**Fix:**
- Manually confirmed the stuck account via Supabase SQL Editor:
  `update auth.users set email_confirmed_at = now(), confirmed_at = now() where email = '<account email>';`
- Turned off "Confirm email" in Authentication > Providers > Email to prevent
  recurrence during testing. **Before production launch, re-enable "Confirm email"
  and configure custom SMTP (Authentication > Settings > SMTP Settings)** so real
  users receive confirmation emails reliably without hitting Supabase's shared-service
  rate limit.

**Status:** Resolved — user confirmed driver registration now works.

---

### 2026-06-10 — Driver verification UI: document upload + admin review

**Why:** Pending Work item #4. `lib/driver-verification-service.ts` already did real Supabase storage/DB uploads and approve/reject logic, but no screen called it — drivers had no way to upload documents, and admins had no way to review them.

**Fix:**
- New `supabase-schema-driver-documents.sql` (additive migration — **the user must run this in Supabase Dashboard > SQL Editor**) — adds `"verificationProgress" numeric default 0` to `public.drivers`, and a new `driver_documents` table (`driverId`, `type` in `'license'|'insurance'|'registration'|'background_check'|'vehicle_inspection'`, `documentUrl`, `status` in `'pending'|'approved'|'rejected'`, `rejectionReason`, `expiryDate`, timestamps) with RLS allowing drivers to SELECT/INSERT only their own documents (no driver UPDATE policy — only the service role can approve/reject). Also documents the required private "documents" storage bucket and its `storage.objects` RLS policies (drivers can upload/view only under `drivers/<driverId>/...`, scoped via `storage.foldername()`).
- `lib/storage-service.ts` — added `DOCUMENTS_BUCKET = 'documents'` and a new `uploadPrivateFile(uri, path)` method (uploads to the private bucket, returns the storage path).
- `lib/driver-verification-service.ts` — `uploadDocument` now uses `StorageService.uploadPrivateFile` instead of the public-bucket `uploadFile`; `getDriverDocuments` now orders results by `uploadedAt desc`.
- New `app/driver-documents.tsx` — driver-facing screen listing all 5 required document types with per-type status badges (none/pending/approved/rejected), an overall verification progress bar, image-picker-based upload/re-upload, and a "Run Background Check" action for the `background_check` type. Registered as a Stack screen in `app/_layout.tsx` and linked from a new "Document Verification" item in `app/(driver-tabs)/profile.tsx` (uses `router.push('/driver-documents' as any)`, matching the existing typed-routes workaround used elsewhere until `.expo/types/router.d.ts` regenerates).
- New backend routes `backend/trpc/routes/admin/driver-documents/route.ts` (`admin.driverDocuments` query — lists documents filtered by status, joined with driver name/email, with signed URLs for previews via `supabaseAdmin.storage.from('documents').createSignedUrl(...)`) and `backend/trpc/routes/admin/review-document/route.ts` (`admin.reviewDocument` mutation — approves/rejects a document, recomputes the driver's `verificationProgress`/`isVerified` from approved document counts). Both registered in `backend/trpc/app-router.ts` under the `admin` router.
- New `app/(admin-tabs)/verification.tsx` — admin review queue with status filter chips (Pending/Approved/Rejected/All), document cards showing a signed-URL image preview and driver info, and Approve / Reject (with optional reason, via modal) actions wired to `admin.reviewDocument`. Added a new "Verify" tab (ShieldCheck icon) to `app/(admin-tabs)/_layout.tsx`.

**Status:** Code complete, type-checks clean (`tsc --noEmit` shows only the same pre-existing unrelated errors as before). **The user must run `supabase-schema-driver-documents.sql` in the Supabase SQL Editor and manually create a private "documents" storage bucket with the policies documented in that file** before uploads/reviews work end-to-end.

---

### 2026-06-10 — Real admin authentication + admin dashboard/users backed by Supabase

**Why:** Pending Work item #2 (admin panel hardening) was blocked on a decision. Initially considered an `ADMIN_API_TOKEN` shared-secret header to protect new service-role-key routes, but any `EXPO_PUBLIC_*` token would be bundled into the client and extractable — not real security. User chose to design real admin authentication instead: admin login should create a real Supabase session, and the backend should verify that session's JWT and check `role='admin'` before using the service-role key.

**Fix:**
- `.env` / `.env.example` / `env.example` — added `SUPABASE_SERVICE_ROLE_KEY` (server-only, left empty — **the user must fill this in from Supabase Dashboard > Settings > API > service_role key**; it bypasses RLS and must never be bundled into the app).
- New `lib/admin-auth-service.ts` — real Supabase-backed admin auth, mirroring `lib/driver-auth-service.ts`. `signInWithEmail` signs in via `AuthService`, then checks the user's `users.role === 'admin'`; if not, signs the session back out and throws `Error('This account does not have admin access.')`. Maps a real `users` row onto the existing elaborate `AdminUser` type via `mapToAdminUser()`.
- `hooks/useAdminAuthStore.ts` — rewritten to mirror `useDriverAuthStore.ts`'s AsyncStorage persistence pattern (`admin_auth_user` key): loads cached admin instantly on mount, syncs with `supabase.auth.onAuthStateChange` in the background, persists on login, clears on logout. Dropped the unused `checkAuthStatus` (no callers) and the old hardcoded `admin@rideapp.com`/`admin123` mock check.
- `components/AdminLogin.tsx` — surfaces the real error message (e.g. "This account does not have admin access.") instead of a generic "Invalid credentials".
- New `backend/lib/supabase-admin.ts` — service-role Supabase client (`null` if `SUPABASE_SERVICE_ROLE_KEY`/`EXPO_PUBLIC_SUPABASE_URL` unset), used only on the server.
- `backend/trpc/create-context.ts` — new `adminProcedure` middleware: verifies `Authorization: Bearer <token>` via `supabaseAdmin.auth.getUser(token)`, then checks `users.role === 'admin'` via the service-role client (bypasses RLS). Throws `UNAUTHORIZED` if the token is missing/invalid or the user isn't an admin, or `INTERNAL_SERVER_ERROR` if `SUPABASE_SERVICE_ROLE_KEY` isn't configured.
- `lib/trpc.ts` — `httpLink` now sends `Authorization: Bearer <supabase access token>` (from `supabase.auth.getSession()`) on every tRPC request; harmless no-op for non-admin routes.
- New `backend/trpc/routes/admin/overview/route.ts` — `admin.overview` query returns `totalUsers`, `totalRiders`, `totalDrivers`, `activeDrivers`, `ridesToday`, `totalRevenue` (sum of completed ride fares), and `recentActivity` (last 5 user/driver/ride events merged and sorted by `createdAt`).
- New `backend/trpc/routes/admin/users/route.ts` — `admin.users` query returns a unified `users` list (riders from `users` + all `drivers`, with `totalRides` computed from completed `rides`) plus `stats` (`totalUsers`, `activeDrivers`, `totalRiders`).
- `backend/trpc/app-router.ts` — registered `admin: { overview, users }`.
- `app/(admin-tabs)/dashboard.tsx` — replaced hardcoded stats/"Recent Activity" with `trpc.admin.overview.useQuery()`; removed the fake +/-% change badges (no historical data available); shows a spinner while loading and a friendly message (including a "not configured" hint) on error.
- `app/(admin-tabs)/users.tsx` — replaced the hardcoded user list and stats row with `trpc.admin.users.useQuery()`; existing search/filter UI now operates on the real list; shows a spinner/error/empty state.

**Status:** Code complete, type-checks clean (`tsc --noEmit` shows only the same pre-existing unrelated errors in `driver-message.tsx`, `messages.tsx`, `Map.tsx`, and `testing/integration/*`). **Two setup steps required before the admin panel works end-to-end**: (1) set `SUPABASE_SERVICE_ROLE_KEY` in `.env` from Supabase Dashboard > Settings > API; (2) promote at least one account to admin by running `update public.users set "role" = 'admin' where "email" = 'your-admin-email@example.com';` in the Supabase SQL Editor, then log into the admin panel with that account's email/password.

---

### 2026-06-10 — Ride rating → Supabase

**Why:** Pending Work item #4. `useRatingsStore` persisted reviews to AsyncStorage only, and the real `lib/rating-service.ts` (Supabase-backed) had no callers. Separately, the entire rate-driver flow was dead code: `app/ride-progress.tsx` never navigated to `/rate-driver` after a ride completed, so `pendingReviewDriverId` was set but never read.

**Fix:**
- New `supabase-schema-ratings.sql` (additive migration — **the user must run this in Supabase Dashboard > SQL Editor**) — adds `"totalRatings"`/`"ratingDistribution"` columns to `drivers`, a new `ratings` table (`rideId` is `text`, not FK-constrained, so it accepts both real ride UUIDs and `local-ride-*` fallback IDs) with RLS and a unique `("rideId", "userId")` constraint, plus a `security definer` RPC `submit_rating(...)` that inserts the rating (rejecting duplicates), recomputes the driver's average/count/distribution, and stamps `rides.driverRating` when `rideId` is a real UUID.
- `lib/rating-service.ts` — rewritten to call `supabase.rpc('submit_rating', ...)` and query the `ratings`/`drivers` tables directly (no longer goes through `lib/database-service.ts`). Removed `updateDriverRating()` — that logic now lives inside the `submit_rating` RPC. `getRideRating()` signature changed from `(rideId)` to `(rideId, userId)` since RLS restricts reads to `auth.uid() = "userId"`.
- `types/index.ts` — `Review` now has `rideId: string` and `tags?: string[]`.
- `hooks/useRatingsStore.ts` — rewritten to branch on `isSupabaseUser`: real users call `RatingService.submitRating`/`getUserRatings`/`getRideRating`; `test-rider` keeps AsyncStorage. `addReview` signature changed to `(rideId, driverId, rating, comment?, tags?)`. Removed the unused `pendingReviewDriverId`/`setPendingReview`/`clearPendingReview`/`updateReview`/`deleteReview`/`getDriverReviews`/`getUserReviews` (all dead code, superseded by direct navigation below).
- `hooks/useRideStore.ts` — `completeRide()` now returns the completed `RideRequest` (or `undefined`) instead of `void`; removed the now-unused `setPendingReview` call.
- `app/ride-progress.tsx` — when a real-time ride update reports `status === 'completed'`, captures `completeRide()`'s return value and navigates to `/rate-driver` with `rideId`/`driverId`/`driverName` params if a driver was assigned, falling back to `/(tabs)/home` otherwise.
- `app/rate-driver.tsx` — now reads `rideId` from route params (required alongside `driverId`) and passes it to `addReview(rideId, driverId, rating, comment)`.
- `testing/integration/ratings.test.ts` — rewritten against the new Supabase-backed API; added a `vi.mock('@/lib/supabase', ...)` with a chainable query-builder mock (no prior precedent existed for mocking the Supabase client in this codebase).

**Status:** Code complete, type-checks clean (`tsc --noEmit`, same 15 pre-existing unrelated errors as before), `ratings.test.ts` passes (10/10). **The user must run `supabase-schema-ratings.sql` in the Supabase SQL Editor** before real-user rating submission works. Note: the `/rate-driver` navigation only fires when a ride's status transitions to `'completed'` via the real-time Supabase subscription — `local-ride-*` simulated rides never reach `'completed'` status (a pre-existing gap, tracked separately).

---

### 2026-06-10 — Wallet backend + secure Paystack/Flutterwave proxy

**Why:** Pending Work item #3. `useWalletStore` was AsyncStorage-only (balance lost on reinstall), and `lib/paystack-service.ts`/`lib/flutterwave-service.ts` read `EXPO_PUBLIC_PAYSTACK_SECRET_KEY`/`EXPO_PUBLIC_FLUTTERWAVE_SECRET_KEY` — a security flaw, since any `EXPO_PUBLIC_*` var is bundled into the client and would expose the secret keys if ever set.

**Fix:**
- New `supabase-schema-wallet.sql` (additive migration — **the user must run this in Supabase Dashboard > SQL Editor**) — adds `wallets`, `wallet_transactions`, and `wallet_bank_accounts` tables with RLS (`auth.uid() = "userId"`), plus a `security definer` RPC `add_wallet_transaction(...)` that locks the balance row, rejects debits that would overdraw, updates the balance, and inserts a ledger row atomically.
- New backend tRPC routes under `payments.paystack.*` and `payments.flutterwave.*` (`backend/trpc/routes/payments/**`) — read `PAYSTACK_SECRET_KEY`/`FLUTTERWAVE_SECRET_KEY` (server-only, no `EXPO_PUBLIC_` prefix) and call the Paystack/Flutterwave APIs.
- `lib/paystack-service.ts` / `lib/flutterwave-service.ts` — rewritten to call the new routes via `trpcClient.mutation(...)` instead of holding any secret key; method signatures unchanged, so `app/payment-initialize.tsx` needed no changes. Removed unused `createSubaccount()`/`getBanks()` and the old `EXPO_PUBLIC_*_SECRET_KEY` constants.
- New `lib/wallet-service.ts` — Supabase CRUD for wallet balance, transactions, and bank accounts.
- `hooks/useWalletStore.ts` — rewritten to branch on `isSupabaseUser` (`user?.id && user.id !== 'test-rider'`): real users read/write Supabase via `WalletService`; the `test-rider` test account keeps its original AsyncStorage mock behaviour unchanged.
- Deleted dead `components/PaystackPayment.tsx` (never imported; mocked success via `setTimeout`).
- `.env` / `.env.example` / `env.example` — added `EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY` + `FLUTTERWAVE_SECRET_KEY` placeholders alongside Paystack; comments clarify `*_SECRET_KEY` vars are server-only.
- `app/payment-gateway-select.tsx` — info box now lists the correct (server-only) env var names.

**Status:** Code complete. **The user must run `supabase-schema-wallet.sql` in the Supabase SQL Editor** before real-user wallets work — until then `WalletService` calls will fail for logged-in (non-test-rider) users. Both Paystack and Flutterwave gateways are kept (confirmed with user).

---

### 2026-06-10 — Global auth/role route guard

**Why:** Pending Work item #2 from the audit. `(driver-tabs)` and `(admin-tabs)` are file-based route groups under `app/`, so Expo Router makes them reachable directly (e.g. `/(driver-tabs)/dashboard`, `/(admin-tabs)/settings`, or even the flattened `/dashboard`/`/settings`) regardless of session or role — completely bypassing both the rider `AuthGuard` and the standalone `admin-app.tsx`/`AdminAuthProvider` flow. `(admin-tabs)/settings.tsx` calls `useAdminAuth()`, which would `undefined`-destructure and crash if reached this way, since no `AdminAuthProvider` wrapped the main app tree.

**Fix:**
- `app/(driver-tabs)/_layout.tsx` — wrapped the tab navigator in `<AuthGuard requireDriver>` (the same component `(tabs)` already used for rider auth), so an unauthenticated session is redirected to `/role-selection`.
- `app/(admin-tabs)/_layout.tsx` — now calls `useAdminAuth()`; shows a loading spinner while checking, renders `AdminLogin` if `!isAuthenticated`, and only renders the admin tabs once logged in.
- `app/_layout.tsx` — added `AdminAuthProvider` to the root provider tree so `useAdminAuth()` works for any screen reached via the main app, not just the standalone `admin-app.tsx` entry point.

**Status:** Code complete, type-checks clean (`tsc --noEmit`, same 13 pre-existing unrelated errors as before). Not yet verified on-device that deep-linking to `/(driver-tabs)/dashboard` or `/(admin-tabs)/settings` while logged out now redirects/shows login correctly.

---

### 2026-06-10 — Wire up core ride loop + real-time tracking

**Why:** Pending Work items #1 and #2 from the audit. A booked ride never reached a driver, and `app/ride-progress.tsx` simulated the entire trip with timers regardless of what really happened in the backend. Investigation found a pull-based driver flow already existed (`useDriverStore` + `FirebaseDriverService.subscribeToRideRequests`/`acceptRide`), so calling `RideMatchingService.matchRideWithDriver()` (auto-assign) as the audit literally suggested would have conflicted with it. Also found the driver-side status convention (`'pending'|'accepted'|'in-progress'|'completed'|'cancelled'`) didn't match the rider-side `'confirmed'|'in_progress'` values used by the old simulation.

**Fix:**
- `hooks/useDriverStore.ts` — `subscribeToRideRequests` now diffs incoming pending rides against previously-seen IDs and calls `NotificationService.notifyNewRideRequest()` for any new ones, so an online driver gets a local alert when a rider books.
- `lib/notification-service.ts` — fixed hardcoded `$` → `₦` in `notifyNewRideRequest`.
- `app/ride-progress.tsx` — replaced the single timer-based simulation effect with two effects:
  - A real-time effect (for any ride with a real Supabase row) that subscribes to `RideMatchingService.subscribeToRideUpdates` (ride status/driverId changes) and `subscribeToDriverLocation` (live GPS), maps `accepted`/`in-progress`/`completed`/`cancelled` to `driver_assigned`/`driver_arriving`/`driver_arrived`/`trip_in_progress`, fetches the real driver profile via `FirebaseDriverService.getDriver`, and calls `completeRide()`/`cancelRide()` when the driver finishes or cancels the trip.
  - The original timer simulation, now scoped to `local-ride-*` IDs only (the fallback used when a Supabase insert fails for non-Supabase users).
- `types/index.ts` — added `'in-progress'` (hyphen) to `RideRequest['status']` so the rider-side state can hold the driver-side canonical status value without a cast.

**Status:** Code complete, type-checks clean (`tsc --noEmit`). Not yet tested end-to-end on a real device with two accounts (rider + driver).

---

### 2026-06-10 — Feature Status audit

**Why:** A full code audit was run against the Feature Status table to check which "Partial"/"Working" items are actually functional before prioritizing further work.

**Findings (see corrected Feature Status table above):**
- Ride matching, push notifications, and real-time driver tracking are implemented as services but **never called/wired into the app** — a booked ride never reaches a driver, and ride-progress.tsx simulates everything via timers.
- Rider wallet and ratings/reviews persist to **AsyncStorage only**, not Supabase.
- Driver earnings/wallet read from **Firebase**, not Supabase as previously documented.
- Paystack mobile flow uses a `setTimeout` mock success in `components/PaystackPayment.tsx`; no transaction is recorded to Supabase. Flutterwave code is real but has no env vars set.
- Promotions, saved places, weather widget, and schedule-a-ride are mock/local-only with no backend effect.
- Phone login is fully mocked (hardcoded OTP `123456`).
- No global auth/role guard exists in `app/_layout.tsx` — any screen, including `(admin-tabs)` and `(driver-tabs)`, is reachable via deep link regardless of login state or role.
- Production env vars are mostly fine (Supabase + Google Maps real values present; Firebase no longer needed since migration to Supabase). Only Paystack (test keys), Mapbox (token unset), and Flutterwave (no keys) remain.

---

### 2026-06-05 — Ride type picker in trip details sheet

**Why:** The fare calculation and tier data were fully implemented but the trip-details bottom sheet in `app/ride-confirmation.tsx` had no UI for selecting a ride type — riders had no way to choose Standard, Comfort, or XL before booking.

**Fix:**
- `app/ride-confirmation.tsx` — Added an inline tier picker (3 cards in a row) into the "Trip details" bottom sheet, between the destination card and the fare-adjustment card.
- Cards show: vehicle icon, tier name, fare for that tier (from `tierPrices`), ETA.
- Selecting a tier calls `setSelectedRideType` → the `estimatedPrice` at the top of the sheet updates automatically.
- Styled to match the dark sheet theme; selected card has teal accent border.

---

### 2026-06-05 — Tiered Nigerian pricing (Bolt-style, −5%)

**Why:** Old formula (`₦500 + ₦150/km × multiplier`) had no per-minute rate — badly undercharges in Lagos traffic. Currency was also hardcoded as `'USD'` in the payment service. Pricing logic was duplicated in 3 files.

**Rates implemented (Bolt Nigeria −5%):**

| Tier | Base | /km | /min | Min fare |
|---|---|---|---|---|
| Standard | ₦333 | ₦90 | ₦8 | ₦665 |
| Comfort | ₦475 | ₦124 | ₦10 | ₦855 |
| XL | ₦570 | ₦143 | ₦11 | ₦950 |

Formula: `max( (base + km×perKm + min×perMin) × surge, minFare )`

**Files changed:**
- `lib/pricing-config.ts` *(new)* — single source of truth for all tier rates
- `lib/fare-calculator.ts` *(new)* — pure `calculateFare()` and `calculateAllTierFares()` functions
- `mocks/rideTypes.ts` — replaced 4 tiers (Standard/Comfort/Premium/XL) with 3 (Standard/Comfort/XL); removed Premium
- `hooks/useRideStore.ts` — replaced inline `₦500+₦150×km` formula with `calculateFare()`; added `tierPrices` state populated by `calculateAllTierFares()`; exposed `tierPrices` from the store
- `components/RideTypeSelector.tsx` — replaced `estimatedPrice × item.multiplier` with `tierPrices[item.id]` so each tier card shows its own correct price
- `app/search.tsx` — replaced inline pricing functions with `calculateFare` / `calculateAllTierFares`; now passes both distance and duration to the calculator
- `lib/payment-service.ts` — fixed `currency: 'USD'` → `'NGN'`; replaced USD rate table with call to shared `calculateFare()`

---

### 2026-06-05 — Fix login/logout stuck on splash screen

**Problem:** After rider login or logout, the app navigated to `router.replace('/')` (the splash/index screen). The index screen has a guard `if (driverLoading) return` — and `driverLoading` could stay `true` indefinitely because `useDriverAuthStore` had no fallback path: it only resolved when a Supabase network event fired.

**Root cause:** `useDriverAuthStore` had no AsyncStorage fallback (unlike `useAuthStore`). Also, if `getDriverByUserId` threw an error inside `onAuthStateChanged`, the callback was silently swallowed and loading never cleared.

**Fixes applied (4 files):**

- `app/login.tsx:45` — Changed `router.replace('/')` to `router.replace('/(tabs)/home')`. Rider login now goes directly to the home tab, bypassing the splash guard entirely.
- `app/(tabs)/account.tsx:133` — Changed `router.replace('/')` to `router.replace('/role-selection')`. Rider logout now goes directly to role-selection.
- `hooks/useDriverAuthStore.ts` — Added 5-second `setTimeout` fallback: if the Supabase auth event hasn't fired within 5 seconds, `driverLoading` is forced to `false`. Prevents permanent stuck state on slow networks.
- `lib/driver-auth-service.ts:122` — Wrapped the async body of `onAuthStateChanged` in `try/catch`. If `getDriverByUserId` throws (network failure, RLS error), `callback(null)` is called so `driverLoading` always clears.

**Status:** Fixes applied locally. Not yet committed to GitHub.

---

### 2026-06 (early) — Push codebase to GitHub

- Pushed 47 files to `https://github.com/Shenum1/Pantra-ride-app.git` on branch `main`.
- First push of the Expo project from local to remote.

---

### Earlier sessions — Core infrastructure built

- Supabase auth integration for riders and drivers (`lib/auth-service.ts`, `lib/driver-auth-service.ts`)
- Firebase / Firestore real-time setup (`lib/firebase.ts`, `lib/firebase-driver-service.ts`)
- Google Maps API integration (`lib/google-maps-service.ts`)
- Paystack payment gateway (`lib/paystack-service.ts`, `components/PaystackPayment.tsx`)
- Flutterwave payment gateway (`lib/flutterwave-service.ts`)
- Driver real-time location tracking (`lib/location-tracking-service.ts`)
- Ride matching service (`lib/ride-matching-service.ts`)
- In-app messaging (`lib/messaging-service.ts`)
- Push notifications (`lib/notification-service.ts`)
- Driver verification flow (`lib/driver-verification-service.ts`)
- Admin panel screens (`app/(admin-tabs)/`)
- Ratings system (`lib/rating-service.ts`, `hooks/useRatingsStore.ts`)
- Wallet system screens and hooks
- Dark/light theme (`hooks/useThemeStore.ts`)
- Device security (`lib/device-security-service.ts`, `hooks/useDeviceSecurityStore.ts`)
- Firebase diagnostics screen (`app/firebase-diagnostics.tsx`)
- Maps diagnostics screen (`app/maps-diagnostic.tsx`)

---

## Pending Work

_Last reviewed 2026-10-06._

### Before production launch

1. **Run `supabase-schema-users-role-lockdown.sql`** and review existing admin accounts — closes the admin self-promotion hole. Security blocker.
2. **Confirm migrations are applied** in the production Supabase project (rider wallet lockdown, user roles, cash commission, payouts automation, refunds, push tokens).
3. **Switch Flutterwave to live keys** (Vercel + EAS) and register the live webhook: `https://<production domain>/api/webhooks/flutterwave`.
4. **Decide on driver payouts** — whitelist the backend's outbound IP with Flutterwave (Vercel has no fixed IP by default), or keep paying manually from the admin queue.
5. **Email confirmation** — make sure Supabase "Confirm email" is on, with custom SMTP so emails aren't rate-limited.
6. **Remove server secrets from EAS** — `FLUTTERWAVE_SECRET_KEY` (preview), `SUPABASE_SERVICE_ROLE_KEY` (production).
7. **GitHub settings** — add `EXPO_TOKEN` and `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` secrets, a `production-submit` environment with required reviewers, and branch protection on `main`.
8. **Test end to end on real devices** — book → driver accepts → live tracking → complete → rate; wallet top-up; cash ride commission; payout; refund.
9. **Reward task content** — add the YouTube task row in `reward_tasks` once the video URL is available.

### Legal documents dependencies

- **Finish the features the legal drafts assume** — the 18 items in the 2026-10-06 "To do today" entry above (cancellation fee collection, reward points, SOS 112, trusted contacts, account deletion, data download, password change, privacy toggles, receipts, suspension, expiry dates, lost property, background location, acceptance records, policy links, shared rides, fee split).
- **Fix the security issues** listed in the same entry (public `drivers` read, pending-ride passenger data, open `messages` policies, unauthenticated endpoints, plaintext bank numbers).
- **Answer the open questions** in `docs/legal/legal-business-decisions.md`, then have a lawyer review `docs/legal/` before publishing.

### Store submission

10. **Google Play** — create the app (`com.pantra.rides`) in Play Console; submit the production `.aab` with `eas submit` (needs the service-account key).
11. **Apple** — join the Apple Developer Program; no iOS build or iOS submit config exists yet.
12. **Store assets** — screenshots, descriptions, privacy policy URL.

---

## Key File Map

| What you want to change | Where |
|---|---|
| App entry, providers, splash | `app/_layout.tsx`, `app/index.tsx` |
| Rider auth | `hooks/useAuthStore.ts`, `lib/auth-service.ts`, `lib/google-auth-service.ts` |
| Driver auth & verification | `hooks/useDriverAuthStore.ts`, `lib/driver-auth-service.ts`, `app/driver-verification/`, `backend/services/verification/` |
| Fares & pricing | `lib/fare-calculator.ts`, `lib/pricing-config.ts`; server-side fare: `backend/trpc/routes/rides/create/route.ts` |
| Ride booking & tracking | `hooks/useRideStore.ts`, `app/search.tsx`, `lib/ride-matching-service.ts`, `lib/firebase-driver-service.ts` (Supabase-backed despite the name) |
| Payments (top-ups, webhooks) | `backend/lib/flutterwave-checkout.ts`, `backend/lib/payment-processor.ts`, webhooks in `backend/hono.ts` |
| Wallet | `lib/wallet-service.ts`, `hooks/useWalletStore.ts`, `add_wallet_transaction` in `database/schemas/` |
| Driver payouts | `backend/lib/payout-processor.ts`, `backend/lib/flutterwave-payout-provider.ts` |
| Refunds | `backend/lib/refund-processor.ts` |
| Cash-ride commission | `backend/lib/cash-commission.ts` |
| Maps & location | `components/Map.tsx`, `lib/google-maps-service.ts`, `lib/location-tracking-service.ts` |
| Notifications | `lib/notification-service.ts`, `backend/trpc/lib/push-notify.ts` |
| Backend API routes | `backend/trpc/app-router.ts`, `backend/trpc/routes/` |
| Admin web panel | `admin-web/src/pages/`; shared admin logic `backend/services/admin/` |
| AI admin agent API | `backend/agent-admin/` |
| Database schema | `database/schemas/*.sql` (run by hand in Supabase) |
| Builds, OTA, CI | `app.json`, `app.config.js`, `eas.json`, `.github/workflows/` |
| Web/API hosting | `vercel.json`, `api/index.ts` |
| Colors & theme | `constants/colors.ts`, `hooks/useThemeStore.ts` |
| Shared types | `types/index.ts` |
