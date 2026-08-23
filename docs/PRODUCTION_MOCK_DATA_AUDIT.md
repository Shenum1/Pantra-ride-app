# Production Mock Data & Hardcoded Fallback Removal — Audit Report

**Date:** 2026-08-24
**Scope:** Full repository audit for mock/fake/demo data and dishonest fallback behavior, followed by removal at the source.

## Summary

The **backend** (all 25 `backend/trpc/routes/**` route files, Paystack/Flutterwave payment verification, driver-verification services) was audited and found **clean** — every route reads/writes real Supabase data or calls real third-party APIs, with no fabricated responses. All remediation work was in the **React Native frontend**.

Two decisions were made with the product owner before implementation:
1. **Directions API fallback**: kept as a resilience feature (doesn't block booking on a transient Google API failure), but is now explicitly labeled as an estimate everywhere it's shown, rather than silently presented as a real routed distance/fare.
2. **Admin Support/Marketing screens**: no backend exists for these features. Converted to honest "not yet available" empty states rather than inventing a new backend.

During implementation, a repo-wide sweep also surfaced a **third, previously-undiscovered admin surface** (`admin/app.tsx`, `admin/server.js`, `admin/web/index.html`) — a fully orphaned prototype with fake users/tickets and a hardcoded fake login credential, referencing routes that didn't exist anywhere in the codebase. It has been removed along with its only entry point, `components/AdminAccess.tsx` (itself never rendered by any real screen).

---

## A. Removed Mock Data

| File | What was fake | How it was used | What replaced it |
|---|---|---|---|
| `app/add-location.tsx` | Every saved address was hardcoded to San Francisco (`37.7749, -122.4194`) regardless of what the user typed | Persisted to the real Supabase `saved_locations` table for authenticated users | Real geocoding via `GoogleMapsService.searchPlaces()`; on no match, the save is rejected with an error instead of saving a fake coordinate |
| `lib/google-maps-service.ts` — `getMockPlaces()` | A hardcoded list of 6 Abuja/Lagos landmarks | Silently substituted for `autocomplete()`/`searchPlaces()`/`getPlaceDetails()` whenever the API key was missing, the request failed, **or a real search genuinely returned zero results** | Removed entirely; all three call sites now return `[]`/`null`, surfaced as "No places found" in the UI |
| `lib/google-maps-service.ts` — `getEstimatedDirections()` | A haversine straight-line distance/duration, returned identically to a real routed result | Silently used for the rider's shown/charged fare and ETA whenever the real Directions API failed | Kept as a resilience fallback, but now carries an explicit `isEstimate: boolean` flag threaded through `useLocationStore`/`useRideStore` into the UI ("Estimated fare — live route unavailable", "Estimated direction", "Est. from ₦X") |
| `hooks/useLocationStore.ts` — `DEFAULT_LOCATION` | A hardcoded Abuja coordinate (`9.0765, 7.3986`) silently set as the rider's `userLocation`/`pickupLocation` on 3 of 4 location-failure branches, with no user-facing indication | Fed directly into ride booking as if it were the real device location | Removed; failures now set `userLocation`/`pickupLocation` to `null` plus an explicit `locationError` message, with a `retryLocation()` action and a visible retry UI in Home/Search/Discover |
| `hooks/useRideStore.ts` — `requestRide()` | A fabricated driver-location offset (`pickup - 0.028/-0.02`) written into the real `rides` DB row and shown as the driver's position whenever no real nearby driver existed | Rendered as a "driver" marker on the rider's map while status text said "Looking for a nearby driver" | `driverLocation` is now `undefined`/`null` until a real driver is actually assigned; no marker renders until then |
| `app/ride-progress.tsx` — driver-assignment branch | `profile?.location ?? buildApproachStart(pickup)` — fabricated a fake offset whenever a just-assigned real driver's device hadn't sent a GPS ping yet | Shown as the assigned driver's live position | `Driver.location` is now optional; a missing real position simply shows no marker instead of a fake one |
| `app/ride-progress.tsx` — full ride simulation `useEffect` (~150 lines) | A fabricated driver ("Alex Johnson", Toyota Corolla, fake phone number) plus `setInterval`/`setTimeout` timers simulating the entire ride lifecycle with interpolated fake GPS movement | Activated for any `local-ride-*` ID (created when the real Supabase ride-create call failed for a non-UUID/dev account) | Deleted entirely, along with its only-used-there helpers (`buildApproachStart`, `interpolateLocation`) |
| `hooks/useRideStore.ts` — `requestRide()` `local-ride-` fallback | On a failed ride-create call, non-Supabase (dev test-rider) users silently got a fake local ride ID instead of an error | Triggered the fake-ride simulation above | Removed; every user now gets the same real "Booking failed" error on a failed create, already handled by existing UI |
| `app/(tabs)/discover.tsx` — `handlePlacePress()` | A fabricated destination offset derived from the place's numeric ID, used when a place had no real coordinates | Would have silently booked a ride to a made-up location | Replaced with an explicit "Location unavailable" alert; no booking proceeds without a real coordinate |
| `app/driver-active-trip.tsx` | On web, the driver's own position was a fixed offset from the pickup point — no real geolocation was ever attempted | Shown as "your vehicle" on the driver's map; never sent to the backend | Real `navigator.geolocation` (matching the pattern already used in `useLocationStore`), with an explicit "Unable to determine your location" state on failure |
| `lib/payment-service.ts` | A dead, unused fake payment processor: `setTimeout(2000)` fake latency + `Math.random() > 0.1` fake 90% success rate | Not imported anywhere in production code | Deleted, along with its test (`testing/integration/payment-service.test.ts`) |
| `hooks/useWalletStore.ts` — `mockWalletData` | A hardcoded ₦12,550 balance, 5 fake transactions, and a fake "Bank of America / John Doe" bank account | Seeded into AsyncStorage and returned for any non-Supabase-authenticated state (including a momentarily logged-out user) | Removed; non-authenticated reads now return the existing `EMPTY_WALLET_DATA` (₦0, no transactions); all wallet mutations for that state now throw "Wallet requires a signed-in account" instead of simulating success |
| `mocks/savedLocations.ts` | Fake "Home"/"Work"/"Gym"/"Shopping Mall" entries at fictional Lagos addresses | Seeded into AsyncStorage for non-Supabase-authenticated state | Removed; that state now starts with an empty saved-locations list |
| `app/(admin-tabs)/support.tsx` | Fully hardcoded: 3 fake tickets, fake stats ("23 pending", etc.), no backend call at all | Shown to every admin regardless of real platform activity | Honest "Support ticket tracking isn't connected to a backend yet" empty state |
| `app/(admin-tabs)/marketing.tsx` | Fully hardcoded: 3 fake campaigns with fake budget/impression/conversion numbers, fake stats, no backend call | Same as above | Honest "Campaign management isn't connected to a backend yet" empty state; "Create New Campaign" now shows an honest "Not yet available" alert instead of doing nothing silently |
| `app/(admin-tabs)/dashboard.tsx` — Quick Actions | "23 pending tickets" hardcoded description; all four actions were `console.log` no-ops | Displayed as if real, did nothing on tap | Generic non-numeric description; "Manage Users"/"Support Tickets" now navigate for real, the other two show an honest "Coming soon" alert |
| `admin/app.tsx`, `admin/server.js`, `admin/web/index.html` *(found during execution, not in the original plan)* | A fully separate, orphaned admin prototype: fake users/tickets inline in a standalone HTML file, a fake hardcoded login credential printed to console, and an Expo screen (`admin/app.tsx`) referencing nested routes that never existed as files anywhere in the repo | Reachable only via `app/admin.tsx` → `components/AdminAccess.tsx`, which was itself never rendered by any real screen | Deleted entirely (all three files), along with `app/admin.tsx` and `components/AdminAccess.tsx` |
| `mocks/rideTypes.ts` *(reclassified, not removed)* | Named "mock" but is actually legitimate ride-tier config (Standard/Comfort/XL catalog) | Real production ride-type catalog | Moved to `constants/ride-types.ts`, renamed `RIDE_TYPES`, to stop it reading as fake data |

---

## B. Remaining Hardcoded Values

**Legitimate configuration (kept as-is):**
- `lib/pricing-config.ts`, `lib/fare-calculator.ts`, `lib/surge-calculator.ts`, `lib/traffic-multiplier.ts` — fare rules, commission %, min fare, surge/traffic multipliers; all documented as backend-overridable defaults, not fake data.
- `constants/ride-types.ts` (formerly `mocks/rideTypes.ts`) — the ride-tier catalog itself is a real, static product decision, same category as "supported vehicle types."
- `constants/nigeria-region.ts` (new, consolidating three previously-duplicated/disagreeing hardcoded coordinate pairs from `components/Map.tsx`, `components/Map.web.tsx`, and `lib/google-maps-service.ts`) — a map-camera/search-bias default only, never presented as a real user/driver location.
- `database/schemas/seed-driver.sql` — dev-only manual SQL script, not wired to any runner or migration; now carries an explicit "DEV/TEST ONLY — DO NOT RUN AGAINST PRODUCTION" header.
- `hooks/useAuthStore.ts`'s `__DEV__`-gated test-rider login, `hooks/useRewardedAd.ts`'s `TestIds` fallback — both correctly compiled out of / inert in production builds.

**Requires product-owner input (not changed — a business decision, not mock data):**
- `app/driver-goals.tsx` `DEFAULT_GOALS` and `app/(driver-tabs)/dashboard.tsx` `WEEKLY_GOAL_NGN = 1000` — a ₦1,000 weekly earnings goal is below a single trip's minimum fare (~₦1,995), so the progress bar reads "Goal completed!" after one ride. This is a leftover placeholder value, not a fake record — left in place pending a real target from the product owner.

---

## C. Missing Real Implementations

| Feature | Current behavior | Expected real source | Missing implementation | Severity |
|---|---|---|---|---|
| Support ticket tracking | Honest empty state | A `support_tickets` (or similar) table + tRPC routes | No backend exists | Medium — admin-facing only, not user-facing |
| Marketing campaign management | Honest empty state | A `campaigns` table + tRPC routes | No backend exists | Medium — admin-facing only |
| Admin settings toggles (`app/(admin-tabs)/settings.tsx`) | All toggles are hardcoded booleans; all handlers are `console.log` no-ops — not fixed in this pass | A settings table/config service | No persistence backend | Low — cosmetic, not misrepresenting data as real |
| Driver custom goals (`app/driver-goals.tsx`) | Driver-added goals live only in `useState`, lost on app restart | AsyncStorage or a real backend table | Not persisted anywhere | Low — pre-existing bug, unrelated to mock data, not fixed here |

---

## D. Production Risks

- **`app/(admin-tabs)/settings.tsx`** still presents fully non-functional toggles as if they work. Not misrepresenting *data*, but worth flagging for a future pass.
- **`WEEKLY_GOAL_NGN`** and the driver goal defaults are implausibly low and need a real business number before they're meaningful to drivers.
- Several `docs/*.md` files (`PRODUCTION_READINESS.md`, `TRANSITION_TO_REAL_DATA.md`, `DRIVER_REAL_DATA_UPDATE.md`, `PAYMENT_INTEGRATION_COMPLETE.md`) describe an earlier, now-stale state of the app (e.g., referencing "mock payment processing" and Stripe) that no longer matches the current, already-real Paystack/Flutterwave-backed payment code. Left unchanged in this pass (docs, not code) but could mislead a future reviewer.

---

## Verification Performed

- **Type-check**: `npx tsc --noEmit` — clean; only the same 11 pre-existing, unrelated errors present before this work started (admin-web `import.meta.env` typing, two missing style keys in `Map.tsx`, and stale Firebase-based assertions in `testing/integration/auth-service.test.ts`).
- **Unit test suite**: `npx vitest run testing/unit` — 167/167 passing. One test (`google-maps-service.test.ts`) that asserted the old mock-fallback behavior was updated to assert the new honest behavior (empty results on failure, `isEstimate: true` on the haversine fallback).
- **Integration suite**: `auth-service.test.ts` and `ride-service.test.ts` fail with `supabaseUrl is required` — a pre-existing local-environment issue (no real Supabase credentials configured in this sandbox), unrelated to this change.
- **Repo-wide sweep**: final grep for `getMockPlaces`, `mockWalletData`, `mockSavedLocations`, `mockRideTypes`, `mocks/adminData`, `DEFAULT_LOCATION`, `local-ride-`, `fallback-driver`, `buildApproachStart`, `interpolateLocation` — zero hits outside of stale prose in `DEVLOG.md`.

### Not yet done (requires a device/browser and real API credentials — recommend before shipping)
- Manually walk the rider flow with location permission denied/GPS off, confirm the retry banner and that booking is correctly blocked with no fake pickup.
- Manually walk booking with the Google Maps API key removed/invalid, confirm "Estimated fare"/"Estimated direction" labels appear and booking still completes.
- Manually confirm no driver marker appears when zero real drivers are online.
- Manually confirm the wallet/saved-locations screens for a logged-out session show empty state, not stale cached mock data from a device that had an older build installed.
- Production bundle build (`expo export`/EAS build).
