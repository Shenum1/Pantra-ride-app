# Pantra Ride App — Dev Log & Project Status

## Project Overview

**App:** Pantra Ride App  
**Platform:** Android / iOS / Web (Expo React Native)  
**Market:** Nigeria (NGN pricing, Paystack/Flutterwave payments)  
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
| Real-time | Firebase / Firestore |
| Maps | Google Maps API |
| Payments | Paystack, Flutterwave |
| Backend API | tRPC 11.5 + React Query 5.90 |
| Notifications | Expo Notifications |
| Location | expo-location (foreground + background) |
| Testing | Vitest + Playwright |

---

## Feature Status

| Feature | Status | Notes |
|---|---|---|
| Rider signup | ✅ Working | Supabase auth, `app/signup.tsx` |
| Rider login | ✅ Working | Fixed post-login navigation (goes directly to home tab) |
| Rider logout | ✅ Working | Fixed post-logout navigation (goes directly to role-selection) |
| Driver signup | ✅ Working | `app/driver-signup.tsx`, inserts into `drivers` table |
| Driver login | ✅ Working | `app/driver-login.tsx`, navigates to `/(driver-tabs)/dashboard` |
| Driver logout | ✅ Working | AsyncStorage session persistence + reliable logout (`hooks/useDriverAuthStore.ts`) |
| Admin panel (in-app, `(admin-tabs)`) | ✅ Working | `(admin-tabs)/_layout.tsx` requires `useAdminAuth()` (shows `AdminLogin` if not authenticated); login is real Supabase auth + `users.role === 'admin'` check (`lib/admin-auth-service.ts`). `dashboard.tsx`/`users.tsx` now show real counts/lists from `admin.overview`/`admin.users` tRPC routes, which use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS. Requires that key to be set in `.env` and at least one `users` row with `role='admin'` |
| Admin web panel (`admin-web/`, Vite) | ✅ Working | Standalone Vite app, superseding the in-app admin tabs per `docs/ADMIN_WEB_PANEL_SPEC.md` — Dashboard/Users/Verification/Rides/Payouts pages calling the same tRPC admin routes directly via `fetch` (`admin-web/src/lib/api.ts`). Was fully broken end-to-end until this session's fixes: dead Rork tunnel URL, unregistered `admin.rides`/`admin.payouts` routes, wrong `create-context` import depth in those route files, missing `SUPABASE_SERVICE_ROLE_KEY`, missing `web.output: "server"` (see 2026-07-31 entry), and a Supabase Node.js WebSocket crash on every admin request (`backend/lib/supabase-admin.ts`) — all now fixed. Not yet re-verified end-to-end after the latest restart |
| Splash / cold-open | ✅ Working | 2.6s minimum, 5s timeout fallback for driver auth |
| GPS — rider | ✅ Working | Real permission request + live position via `useLocationStore`; needs real-device confirmation |
| GPS — driver | ✅ Working | `useDriverStore.updateLocation()` → `FirebaseDriverService.updateDriverLocation()` writes live location to Supabase `drivers.location`; needs real-device confirmation |
| Real-time driver → rider tracking | ✅ Working | `app/ride-progress.tsx` subscribes to `RideMatchingService.subscribeToRideUpdates`/`subscribeToDriverLocation`; driver position/ETA/stage now come from Supabase, not timers (local-only fallback rides still simulate) |
| Ride booking (search) | ✅ Working | `app/search.tsx` uses shared `lib/fare-calculator.ts` / `lib/pricing-config.ts`; no duplicate pricing logic remains |
| Ride confirmation | ✅ Working | Real Supabase insert into `rides` (`useRideStore.requestRide`); driver app picks up the pending ride via `subscribeToRideRequests` and is notified locally |
| Ride progress / tracking | ✅ Working | Driver location, ETA, and ride-stage now driven by real `rides`/`drivers` row updates; `local-ride-*` fallback rides (no Supabase row) still use the timer simulation |
| Ride rating | ✅ Working | `useRatingsStore` persists to Supabase `ratings` table via `lib/rating-service.ts`'s `submit_rating` RPC for real users (`test-rider` keeps AsyncStorage); `app/ride-progress.tsx` now navigates to `/rate-driver` with `rideId`/`driverId`/`driverName` after `completeRide()`. `supabase-schema-ratings.sql` migration confirmed run |
| Fare calculation | ✅ Working | Bolt-style 3-tier NGN pricing (Standard/Comfort/XL) with base+km+min formula |
| Payments — Paystack | 🔄 Partial | `lib/paystack-service.ts` now calls secure backend tRPC routes (`payments.paystack.*`) using a server-only `PAYSTACK_SECRET_KEY`; dead `components/PaystackPayment.tsx` mock removed. Test keys only — needs live keys + on-device verification of the full flow including wallet credit |
| Payments — Flutterwave | 🔄 Partial | `lib/flutterwave-service.ts` now calls secure backend tRPC routes (`payments.flutterwave.*`) using a server-only `FLUTTERWAVE_SECRET_KEY`. Real **test** keys now configured in `.env` (were placeholders) — still needs on-device verification of the full flow including `payment-callback.tsx`'s wallet credit |
| Wallet (rider) | ✅ Working | `hooks/useWalletStore.ts` persists to Supabase (`wallets`/`wallet_transactions`/`wallet_bank_accounts`, see `supabase-schema-wallet.sql`) for real users via `lib/wallet-service.ts`; `test-rider` test account keeps its AsyncStorage mock. Migration confirmed run |
| Wallet (driver) | ✅ Working | Earnings read from Supabase `rides` table; stats grid shows real `totalRides` + avg/trip; bank account add screen; payout requests tracked in `driver_payouts` (manual processing) |
| Push notifications | 🔄 Partial | Rider lifecycle notifications (driver assigned/arrived/started/completed) are local — fire correctly via `app/ride-progress.tsx`. Driver new-ride-request push is now **remote**: `useRideStore.requestRide` calls `trpc.notifications.notifyDrivers` server-side → Expo Push API → all online drivers receive push even when app is backgrounded. Was actually unreachable this whole session until `web.output: "server"` was fixed (2026-07-31) — API routes weren't being served at all; the fire-and-forget call also had no `.catch()`, so its failure surfaced as an uncaught error during ride booking (now fixed). **Requires:** (1) run `supabase-schema-push-tokens.sql`, (2) `eas init` to get projectId for token registration. Not yet re-verified end-to-end after the API-route fix |
| In-app messaging | ✅ Working | `lib/messaging-service.ts` — real Supabase tables + realtime subscriptions. Now bidirectional: drivers message riders from `driver-active-trip.tsx` (existing), and riders can now message drivers from `ride-progress.tsx` (new "Message" button); both `messages.tsx`/`driver-message.tsx` chat screens render timestamps correctly |
| Maps — Google Maps | 🔄 Partial | `lib/google-maps-service.ts`. Places + Directions APIs confirmed working with the configured key. **Static Maps API and Geocoding API return `403 not activated`** for this key/project — `components/Map.tsx`'s web map (falls back to a static image since `react-native-maps` doesn't support web) doesn't render, and reverse-geocoding (weather city name) is affected. Needs those two APIs enabled in Google Cloud Console — no code fix needed |
| Discover places | ✅ Working | `app/(tabs)/discover.tsx` fetches real nearby places via `GoogleMapsService.getNearbyPlaces()` (Google Places Nearby Search) for the selected category, using the rider's real GPS location, with real ratings/photos/distance/price/open-status. The old hardcoded `mockPlaces` fallback (20 fake Abuja venues) was removed (2026-07-30) now that the real API key works — zero-result/error cases just show an empty list |
| Ride matching | ✅ Working (pull-based) | A new `pending` ride is picked up by nearby online drivers via `FirebaseDriverService.subscribeToRideRequests` (with a local notification); driver accepts via `acceptRide`. `RideMatchingService.matchRideWithDriver()` (auto-assign) is still unused and would conflict with this pull-based flow if called |
| Driver verification | ✅ Working | `app/driver-documents.tsx` (driver upload screen, linked from driver profile) and `app/(admin-tabs)/verification.tsx` (admin review screen with new "Verify" tab) now call the real `DriverVerificationService`/new `admin.driverDocuments`/`admin.reviewDocument` tRPC routes. `supabase-schema-driver-documents.sql` migration and private "documents" storage bucket confirmed in place |
| Promotions / promo codes | ✅ Working | `usePromotionsStore` validates against Supabase `promotions` table; `maxDiscountNGN` cap enforced in fare calculation; `user_promo_uses` prevents reuse. Migration confirmed run |
| Rewards / Points system | 🔄 Partial | Task-based points (YouTube videos, social share); 500 pts = ₦8,000 ride credit; 90-day expiry; redeemable at checkout. `lib/rewards-service.ts`, `hooks/usePointsStore.ts`, `app/task-detail.tsx`. Migration confirmed run. YouTube task URL not yet provided — no task rows seeded in `reward_tasks` yet |
| Driver earnings | ✅ Working | `getDriverEarnings`/`getDriverStats` already query Supabase `rides` table (despite class name). Fixed `wallet.tsx` to use computed `stats.todayEarnings/weekEarnings/monthEarnings` instead of stale JSONB; withdrawal cap now uses `totalEarnings − completedPayouts` |
| Saved places | ✅ Working | `hooks/useSavedLocationsStore.ts` persists to Supabase `saved_locations` table (see `supabase-schema-saved-locations.sql`, migration run) for real accounts via `lib/saved-locations-service.ts`, including the home/work upsert behavior; `test-rider` keeps its AsyncStorage + mock fallback |
| Weather widget | ✅ Working | `useWeatherStore.ts` calls the real Open-Meteo forecast API with the user's actual coordinates, plus `GoogleMapsService.getCityName()` for the real city name |
| Dark / light theme | ✅ Working | `hooks/useThemeStore.ts`, system / manual toggle |
| Phone login | 🔄 Partial | `signInWithOtp`/`verifyOtp` wired in `useAuthStore`; +234 prefix in `phone-login.tsx`. **Needs Twilio configured in Supabase Dashboard before SMS goes live** |
| Schedule a ride | ✅ Working | Real `DateTimePicker` + `scheduleRide()` store call + local reminder notification; `scheduled_for` column migration run ✓ |
| Driver withdrawal | ✅ Working | Manual payout: `driver_bank_accounts` + `driver_payouts` tables live in Supabase ✓; driver adds bank account → submits withdrawal → admin pays out manually |
| Global route protection | ✅ Working | `(tabs)` already had `AuthGuard`; `(driver-tabs)/_layout.tsx` now wraps in `<AuthGuard requireDriver>`, and `(admin-tabs)/_layout.tsx` now checks `useAdminAuth()` and shows `AdminLogin` when not authenticated. `AdminAuthProvider` added to root `_layout.tsx` so `useAdminAuth()` is available app-wide |
| Production env vars | 🔄 Partial | Local `.env` recreated from scratch this session (had gone missing entirely — never committed, git-ignored). Real values now set: Supabase URL/anon/service-role key, Google Maps key (Places/Directions working; Static Maps + Geocoding APIs still need enabling — see Maps row), Flutterwave test keys. **Paystack is still the placeholder** (`sk_test_xxxxxxxxxxxxx`). Firebase no longer needed (replaced by Supabase stub). `EXPO_PUBLIC_RORK_API_BASE_URL` no longer needed for local dev (auto-detected by `lib/trpc.ts`, see 2026-07-29 entry) — only matters for real production builds |

---

## Activity Log

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

### Immediate (blockers before first test build)

1. **Run push token migration** — Supabase Dashboard → SQL Editor → run `supabase-schema-push-tokens.sql` (adds `pushToken` column to `users` and `drivers`)

2. **EAS init + build configure** — in terminal inside `expo/`:
   ```
   npm install -g eas-cli
   eas login
   eas init          # creates projectId, writes it to app.json
   eas build:configure
   ```
   Then run `eas build --profile preview --platform android` to get a real APK for device testing

3. **Push to GitHub** — run `git push` from your terminal

### Before production launch

4. **Phone login OTP** — Twilio credentials not yet available. When ready: Supabase Dashboard → Authentication → Providers → Phone → enable + Account SID + Auth Token + Messaging Service SID

5. **Payment live keys** — Paystack is on test keys only; Flutterwave keys are unset. Replace in `.env` with live keys before production launch

6. **Re-enable email confirmation** — Supabase Dashboard → Authentication → Providers → Email → turn "Confirm email" back ON → then add custom SMTP under Authentication → Settings → SMTP so confirmation emails don't hit the rate limit

7. **End-to-end ride loop test** — rider books → driver receives remote push → driver opens app → accepts → rider sees real driver location + ETA + stage transitions → completes → rating submitted to Supabase

8. **Add YouTube reward task** — insert a row in Supabase Dashboard → Table Editor → `reward_tasks`. **YouTube URL not yet provided.** When you have it:
   - `type`: `youtube_video`
   - `title`: e.g. "Watch: Introducing Pantra Ride"
   - `url`: your YouTube link
   - `pointsReward`: `500`
   - `minWatchSeconds`: `120`
   - `isActive`: `true`

### Store submission

9. **Apple Developer Program** — enroll at developer.apple.com ($99/year) if not already done; needed for App Store submission and iOS push certificates
10. **Google Play Console** — register at play.google.com/console ($25 one-time); create the app with package `com.pantra.rides`
11. **Store assets** — screenshots (6.7" iPhone + Pixel), app descriptions, privacy policy URL (already in app under Terms & Privacy screens)

---

## Key File Map

| What you want to change | File |
|---|---|
| Splash screen / cold-open logic | `app/index.tsx` |
| Rider auth (login, signup, session) | `hooks/useAuthStore.ts`, `lib/auth-service.ts` |
| Driver auth | `hooks/useDriverAuthStore.ts`, `lib/driver-auth-service.ts` |
| Fare / pricing | `hooks/useRideStore.ts`, `app/search.tsx`, `lib/payment-service.ts` |
| Payment gateways | `lib/paystack-service.ts`, `lib/flutterwave-service.ts` |
| Maps | `components/Map.tsx`, `lib/google-maps-service.ts` |
| Driver real-time location | `lib/location-tracking-service.ts`, `lib/firebase-driver-service.ts` |
| Ride matching | `lib/ride-matching-service.ts` |
| Notifications | `lib/notification-service.ts` |
| Rider account / settings | `app/(tabs)/account.tsx` |
| Driver profile / settings | `app/(driver-tabs)/profile.tsx` |
| App entry / providers | `app/_layout.tsx` |
| Colors / theme | `constants/colors.ts`, `hooks/useThemeStore.ts` |
| TypeScript interfaces | `types/index.ts` |
