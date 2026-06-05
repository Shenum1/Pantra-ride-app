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
| Maps | Google Maps API + Mapbox |
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
| Driver logout | ✅ Working | Already navigated correctly pre-fix |
| Admin panel | 🔄 Partial | Screens exist (`(admin-tabs)/`), auth not production-hardened |
| Splash / cold-open | ✅ Working | 2.6s minimum, 5s timeout fallback for driver auth |
| GPS — rider | 🔄 Needs testing | `expo-location` integrated, needs live device test in Expo Go |
| GPS — driver | 🔄 Needs testing | `LocationTrackingService` + Firebase, needs live test |
| Real-time driver tracking | 🔄 Partial | Firebase write side exists; rider map display needs verification |
| Ride booking (search) | 🔄 Partial | `app/search.tsx` working; pricing logic has duplicate code smell |
| Ride confirmation | 🔄 Partial | `app/ride-confirmation.tsx` exists |
| Ride progress / tracking | 🔄 Partial | `app/ride-progress.tsx` exists |
| Ride rating | 🔄 Partial | `app/rate-driver.tsx` exists |
| Fare calculation | ✅ Working | Bolt-style 3-tier NGN pricing (Standard/Comfort/XL) with base+km+min formula |
| Payments — Paystack | 🔄 Partial | Service implemented; currency fixed to NGN |
| Payments — Flutterwave | 🔄 Partial | Service implemented; currency fixed to NGN |
| Wallet (rider) | 🔄 Partial | Screens built; backend write/read needs validation |
| Wallet (driver) | 🔄 Partial | `(driver-tabs)/wallet.tsx` built |
| Push notifications | 🔄 Partial | `lib/notification-service.ts` exists; not end-to-end tested |
| In-app messaging | 🔄 Partial | `lib/messaging-service.ts` + screens exist |
| Maps — Google Maps | ✅ Working | `lib/google-maps-service.ts`, geocoding + routes |
| Maps — Mapbox | 🔄 Partial | `lib/mapbox-service.ts` exists |
| Ride matching | 🔄 Partial | `lib/ride-matching-service.ts` exists; full flow not end-to-end tested |
| Driver verification | 🔄 Partial | `lib/driver-verification-service.ts` exists |
| Ratings & reviews | 🔄 Partial | `lib/rating-service.ts` + hooks exist |
| Promotions / promo codes | 🔄 Partial | `app/enter-promo-code.tsx` + hooks exist |
| Driver earnings | 🔄 Partial | Stored in Supabase `earnings` JSON field |
| Saved places | 🔄 Partial | Hook + screens built |
| Weather widget | 🔄 Partial | `hooks/useWeatherStore.ts` + `components/WeatherCard.tsx` |
| Dark / light theme | ✅ Working | `hooks/useThemeStore.ts`, system / manual toggle |
| Phone login | 🔄 Partial | `app/phone-login.tsx` exists |
| Schedule a ride | 🔄 Partial | `app/schedule-ride.tsx` exists |
| Production env vars | ❌ Blocked | Supabase/Firebase/Maps keys are placeholders in `.env` |

---

## Activity Log

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
- Mapbox integration (`lib/mapbox-service.ts`)
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

1. **Commit & push all recent fixes to GitHub** — Multiple files changed but not yet committed:
   - `app/login.tsx`
   - `app/(tabs)/account.tsx`
   - `hooks/useDriverAuthStore.ts`
   - `lib/driver-auth-service.ts`

3. **Location Testing** — Verify in Expo Go on a real device that:
   - Rider sees their own GPS dot on the home map
   - Driver sees their own GPS dot on the dashboard map
   - GPS permissions are requested and granted at runtime

4. **Real-time driver → rider map** — Confirm that when a ride is active, the driver's live location dot appears on the rider's `app/ride-progress.tsx` map screen.

5. **End-to-end ride flow test** — Full path: rider searches → selects ride type → confirms → driver receives notification → driver accepts → both see live tracking → ride completes → rating screen.

6. **Production environment variables** — Replace placeholder keys in `.env` with real values:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - Firebase config keys
   - Google Maps API key
   - Mapbox token
   - Paystack public key
   - Flutterwave public key

7. **Admin panel hardening** — Add proper auth guards and role checks to all `(admin-tabs)/` screens.

8. **Phone login** — Complete OTP flow in `app/phone-login.tsx`.

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
