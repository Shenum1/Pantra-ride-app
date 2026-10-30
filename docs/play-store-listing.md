# Google Play listing: Pantra (com.pantra.rides)

Drafted 2026-10-30 from the codebase (app.json, app.config.js, public/privacy-policy.html,
public/delete-account.html, app/ screens, DEVLOG.md). Version 1.0.3 (bumped for the permission changes).

Anything marked **TBD (ask owner)** is a business decision the code can't answer.

---

## 0. Fix before submitting

Google reviewers open the app. Status as of 2026-10-30:

**Fixed in code** (needs a new native build, so `version` is now 1.0.3):
1. ✅ **Emergency button** (`app/safety.tsx`): now really dials 112 (Nigeria's emergency
   number) instead of showing a fake "Calling 911..." pop-up. The toggles and rows that saved a
   setting but did nothing (Share Trip Details, Emergency Contacts, RideCheck, Trusted
   Contacts, Safety Center) are removed.
2. ✅ **About screen** (`app/about.tsx`): shows the real app name and version, links to the real
   Terms and Privacy screens, and gives the contact email. The made-up claims ("millions of
   riders across 100+ cities", "Awards"), the "RideApp" name, the fake "2.1.0" version, the pop-up
   rows and the social buttons that did nothing are removed.
3. ✅ **Language screen** removed (it listed 13 languages, but the app is English only).
4. ✅ **Unused permissions removed and blocked** (app.json `blockedPermissions`):
   `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE_LOCATION`, `SCHEDULE_EXACT_ALARM`,
   `RECORD_AUDIO`. Driver tracking only ever used foreground `watchPositionAsync`, so nothing
   changes for drivers. No background-location or exact-alarm declaration forms are needed now.
   After the build, check the final list in Play Console → App bundle explorer → Permissions.

**Still open (owner)**:
5. **Live tracking and chat**: DEVLOG (2026-10-08) says these don't work on production
   until the `chat_read_access` and `realtime_publication` migrations are applied. Apply them,
   or confirm they're already applied, before the description promises them.
6. ✅ **Minimum age is 18+ everywhere**: the Terms already said 18, and the privacy policy's
   Children section now says "under 18" too (web and in-app).
7. ✅ **Privacy policy wording**: now says drivers' location is collected "while they are online
   or on a trip and the Application is open", and that background access isn't requested
   (`public/privacy-policy.html`, `app/privacy-policy.tsx`). Redeploy the web app so the
   public page updates.
   **Known limit:** while a driver is in Google Maps (the Navigate button), Pantra is in the
   background and the rider's map stops updating. Fixing that means building real background
   tracking. That needs an Android foreground service, a disclosure screen, and Play's
   background-location declaration with a demo video.
8. **AdMob IDs**: `app.config.js` uses Google's *test* AdMob app ID when
   `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` isn't set. Make sure the production EAS environment
   has the real ID.

---

## 1. Main store listing

### App name (max 30)
**Pantra: Rides & Rewards** (23)

Alternatives: `Pantra: Book a Ride` (19), `Pantra – Ride & Drive` (21).

### Short description (max 80)
**Book affordable rides, pay with wallet or cash, or sign up to drive and earn.** (77)

Alternative: `Upfront fares, wallet or cash payment, and rewards on every ride.` (65)

### Full description (max 4,000; this is about 1,900)

```
Pantra connects riders with nearby drivers. Book a trip in a few taps, see your fare before you confirm, and pay the way that suits you.

GET WHERE YOU'RE GOING
• Enter your destination and see the fare up front, before you book
• Get matched with a driver close to you
• Follow your driver on the map as they arrive and during your trip
• Message your driver in the app to coordinate pickup
• Book a ride for a friend or family member
• Save Home, Work and favourite places for faster booking

PAY YOUR WAY
• Pay with your Pantra wallet or with cash
• Top up your wallet securely by card through Flutterwave. Pantra never sees or stores your full card number
• Tip your driver from your wallet. 100% of the tip goes to the driver
• Download or share a receipt for every trip
• Apply promo codes for discounts

EARN AS YOU RIDE
• Collect reward points by completing tasks and watching short videos in Coin Dome
• Use your points towards your rides

DRIVE WITH PANTRA
• Already a rider? Become a driver with the same account
• Simple sign-up: add your licence, vehicle details and documents, and we'll verify them
• Keep 90% of every fare
• See incoming ride requests near you and choose which to accept
• Track your earnings, trip history, goals and achievements
• Add your bank account to receive payouts

HELP WHEN YOU NEED IT
• Open a support ticket in the app and follow our replies
• Rate your trip and help keep Pantra respectful for everyone

YOUR DATA, YOUR CHOICE
• Turn personalised ads off at any time in Privacy settings
• Download a copy of your data or delete your account from inside the app

Location: Pantra uses your location to find drivers near you and show your trip on the map. Drivers share their location only while they are online or on a trip, so riders can see them arrive.

Questions? Email pantrateam@gmail.com.
```

Don't add these until they actually work: scheduled rides (hidden for launch), safety or
emergency features (see section 0), multiple languages, or city names (**TBD (ask owner)**:
which cities do you launch in? Adding them, e.g. "Now in Abuja", helps search).

### Graphics

| Asset | Requirement | Status |
|---|---|---|
| App icon | 512×512 PNG, 32-bit, ≤1 MB | Export from `assets/images/icon.png` (1024×1024) |
| Feature graphic | 1024×500 JPG/PNG, no alpha | Not in repo, needs making |
| Phone screenshots | 2–8, 16:9 or 9:16, 320–3840 px per side | Not in repo. Suggested: home/map, fare confirmation, driver arriving, wallet, Coin Dome, driver earnings |
| 7" / 10" tablet screenshots | Optional | Skip (no tablet layout) |
| Promo video | Optional YouTube URL | Skip |

Screenshots must show real screens from a real account, with no placeholder data.

---

## 2. Store settings

| Field | Suggested answer |
|---|---|
| App or game | App |
| Category | **Maps & Navigation** (where most ride-hailing apps are listed). Alternative: Travel & Local |
| Tags (pick up to 5) | Ride-hailing, Taxi, Transportation, Navigation, Travel |
| Email address (public, required) | `pantrateam@gmail.com` (the support email in the app). **TBD (ask owner)**: or `pylifekelvin@gmail.com`, the privacy contact |
| Phone (optional, public) | `+234 916 432 9554` (from `app/support.tsx`). **TBD (ask owner)**: OK to publish? |
| Website | `https://www.pantraride.space` |
| External marketing | Leave on (default) |

---

## 3. App content (Policy → App content)

### Privacy policy
`https://www.pantraride.space/privacy-policy.html` (checked: returns HTTP 200)

### App access
**All or some functionality is restricted** → add instructions:

```
Pantra requires an account. Use these test accounts:

Rider: <email> / <password>
Driver (already verified and approved): <email> / <password>

To test driver mode: sign in with the driver account. The Dashboard tab has an "online" switch. With a rider on another device, book a trip near the driver's location and accept it from the driver dashboard.

Real payments are not needed: use "Cash" as the payment method, or the rider test account's existing wallet balance.
```

**TBD (owner)**: create both accounts on production. Approve the driver in admin-web so the
reviewer isn't stuck waiting for verification, and put a balance in the rider's wallet.
Without working credentials, apps are rejected.

### Ads
**Yes, my app contains ads** (AdMob banner on Discover, rewarded ads in Coin Dome).

### Content rating (IARC questionnaire)
- Category: **All Other App Types**
- Violence / fear / sexuality / language / controlled substances / crude humour: **No** to all
- Gambling or simulated gambling: **No** (reward points come from tasks and ads, never from chance or payment)
- Users can interact or exchange content: **Yes** (rider–driver chat)
- Shares the user's current physical location with other users: **Yes**
- Allows purchases of digital goods: **No** (the wallet pays for rides, a physical service)
- Unrestricted internet / web browser: **No**

Expected result: Everyone / PEGI 3, marked "Users Interact, Shares Location".

### Target audience and content
- Target age groups: **18 and over** only (Terms: "You must be at least 18 years old")
- Appeal to children: **No**
- Not in the Families programme

### News app
No

### COVID-19 contact tracing / status
No (publicly available app, not a COVID app)

### Data safety
See section 4.

### Government apps
No

### Financial features
**My app doesn't provide any financial features.** The wallet is a prepaid balance that can
only be spent on rides and tips inside Pantra. It can't be withdrawn or sent to other people,
and driver payouts are earnings for a service. **TBD (owner, check)**: if Google questions this,
the closest category is "Digital wallet / stored value". Keep the explanation above ready.

### Health apps
No health features

### Advertising ID
**Yes, uses advertising ID**. Use: **Advertising or marketing** (AdMob). `expo-tracking-transparency` adds the `AD_ID` permission.

### Sensitive permission declarations
Play shows these after you upload a bundle that requests them. Background location
and exact alarm are now blocked (section 0, item 4), so neither form should appear. The text
below is kept for later, in case real background tracking is built.

**Location permissions (background location)**. Appears if the bundle requests `ACCESS_BACKGROUND_LOCATION`.
- Feature that uses it: *Drivers' live location during a trip*
- Description:
  ```
  When a driver is online or on a trip, Pantra shares the driver's location with the rider, so the rider can see the driver approaching and follow the trip. Drivers often switch to another navigation app or lock the screen while driving, so location is needed in the background. Background location stops when the driver goes offline or the trip ends, and is never collected for riders in the background.
  ```
- Video: a 30-second or shorter screen recording on a real device: driver goes online → in-app
  prominent disclosure → permission prompt → driver switches to another app → rider's
  screen shows the driver's car still moving. The app must show its own prominent disclosure
  screen *before* the system "Allow all the time" prompt. None exists yet.

**Foreground service (location type)**. Required for Android 14+ targets.
- Type: `FOREGROUND_SERVICE_LOCATION`
- Use: *Navigation / location sharing for an active trip*. The service runs while a driver is
  online or on a trip and shows an ongoing notification. Same video as above.

**Exact alarm**: blocked, so no declaration is needed.

---

## 4. Data safety form

**Overview questions**
| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all user data encrypted in transit? | **Yes** (Supabase, Vercel API, Flutterwave and Sentry all use HTTPS) |
| Which account creation methods? | **Username and password** + **OAuth (Sign in with Google)** |
| Delete-account URL | `https://www.pantraride.space/delete-account.html` (HTTP 200) |
| Can users request deletion of some data without deleting their account? | **No**. Download is available, but partial deletion isn't. Change only if you add it |
| Independent security review | No |
| Committed to Play Families policy | No |

**Data types.** "Shared" means given to a third party that isn't working only on your behalf. Here, that's mainly AdMob.
Service providers (Supabase, Google Maps, Flutterwave, Expo, Sentry) count as *collected*,
not shared. Rider ↔ driver sharing that the user expects (name, live location) is exempt.

| Category → type | Collected | Shared | Required / optional | Purposes |
|---|---|---|---|---|
| **Location → Precise** | Yes | No | Required | App functionality |
| **Location → Approximate** | Yes | **Yes (AdMob)** | Required | App functionality, Advertising or marketing |
| **Personal info → Name** | Yes | No | Required | App functionality, Account management |
| **Personal info → Email address** | Yes | No | Required | App functionality, Account management, Developer communications |
| **Personal info → User IDs** | Yes | No | Required | App functionality, Account management, Analytics (Sentry gets an opaque ID only) |
| **Personal info → Address** | Yes | No | Optional | App functionality |
| **Personal info → Phone number** | Yes | No | Required (needed to book) | App functionality, Account management |
| **Personal info → Other info** (date of birth; family members' names and phone numbers) | Yes | No | Optional | App functionality |
| **Financial info → Payment info** (card type, last 4, expiry from Flutterwave) | Yes | No | Optional | App functionality |
| **Financial info → Purchase history** (trips, wallet top-ups, tips, refunds) | Yes | No | Required | App functionality, Account management |
| **Financial info → Other financial info** (drivers' bank account) | Yes | No | Optional (drivers only) | App functionality |
| **Photos and videos → Photos** (profile photo, driver documents, selfie) | Yes | No | Optional (required for drivers) | App functionality, Fraud prevention, security & compliance |
| **Messages → Other in-app messages** (rider–driver chat, support tickets) | Yes | No | Optional | App functionality, Customer support |
| **App activity → App interactions** | Yes | **Yes (AdMob)** | Required | Analytics, Advertising or marketing |
| **App activity → Other user-generated content** (ratings and review text) | Yes | No | Optional | App functionality |
| **App info and performance → Crash logs** | Yes | No | Required | Analytics (Sentry) |
| **App info and performance → Diagnostics** | Yes | **Yes (AdMob)** | Required | Analytics, Advertising or marketing |
| **Device or other IDs** (push token, advertising ID) | Yes | **Yes (AdMob, ad ID)** | Required | App functionality (push), Advertising or marketing, Fraud prevention |

Not collected: Audio (microphone permission is blocked), Contacts (the address
book isn't read; family contacts are typed in by hand), Health, Files and docs, Calendar,
Web browsing, Installed apps, Search history, Race/ethnicity/religion and the other sensitive
personal info types, Credit score.

"Is this data processed ephemerally?" **No** for all of the above (it's stored).

Before submitting, compare with Google's own AdMob Data safety disclosure
(developers.google.com/admob/android/privacy/play-data-disclosure) in case the SDK version
in use collects anything extra.

---

## 5. Release

**Track**: `eas.json` submits to **internal** testing. New personal developer accounts
must run a **closed test with at least 12 testers for 14 days** before they can apply for production.
**TBD (owner)**: is the developer account personal or organisation?

**Countries**: **TBD (ask owner)**. The app is built for Nigeria (NGN prices,
Flutterwave, NDPR in the policy). Suggest **Nigeria only** at launch.

**Pricing**: Free.

**Release name**: `1.0.3`, plus the versionCode the EAS build assigns

**Release notes (en-US, max 500)**:
```
Welcome to Pantra!
• Book rides with upfront fares
• Pay with your wallet or cash, and tip your driver
• Earn reward points in Coin Dome and use them on rides
• Drive with Pantra and keep 90% of every fare
• Download your data or delete your account from Privacy settings
```

---

## Open questions for the owner
1. Launch cities and countries (listing copy and countries field)
2. Public contact email (pantrateam@ or pylifekelvin@) and whether the phone number is shown
3. Test rider and driver accounts for App access
4. Personal or organisation developer account (closed-testing rule)
5. ~~Final age~~: 18+ (done)
6. Financial features answer: "none" (recommended) or "stored-value wallet"
7. Build background tracking so the rider's map keeps updating while the driver uses Google Maps? (later release)
