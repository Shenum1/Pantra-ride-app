# Pantra Privacy Policy

**Version 1.0 — DRAFT for legal review**
**Effective date:** **BUSINESS DECISION REQUIRED**
**Applies to:** riders, drivers, and anyone whose details are given to us by a rider (for example, a passenger or family member).

> Markers: **BUSINESS DECISION REQUIRED** · **CONFIRM — taken from existing in-app terms** · *(Pending implementation — see DEVLOG 2026-10-06)* · **LEGAL REVIEW REQUIRED**. Remove before publishing. The evidence behind every statement is in `docs/privacy/data-map.md`.

---

## 1. Who we are

This policy explains what personal information Pantra collects, why, who we share it with, and the choices you have.

Pantra is operated by **Pantra Limited**, Nigeria. **CONFIRM — taken from existing in-app terms.** For this policy, Pantra is the data controller.

**LEGAL REVIEW REQUIRED — confirm Pantra's obligations under the Nigeria Data Protection Act 2023 (NDPA) and the Nigeria Data Protection Commission's rules, including whether Pantra must register with the Commission, appoint a Data Protection Officer, and file audits. The old in-app policy names a "Data Protection Officer" in Abuja but no person or contact — BUSINESS DECISION REQUIRED.**

## 2. Information we collect

### 2.1 Information you give us — all users

| Information | When | Required? |
|---|---|---|
| Full name | Sign-up | Yes |
| Email address | Sign-up (or from your Google account) | Yes |
| Phone number | Sign-up, or before your first booking if you signed up with Google | Yes |
| Password | Sign-up with email (stored by our login provider in protected form; Pantra staff cannot see it) | Yes, unless you use Google |
| Profile photo | Sign-up or profile (camera or gallery) | Optional for riders |
| Date of birth, home address | Personal info screen | Optional |
| Saved places (Home, Work, favourites) | When you save them | Optional |
| Messages to your driver/rider | During a ride | Optional |
| Support requests and messages | When you contact support | Optional |
| Ratings, comments and tags | After a ride | Optional |

If you sign in with **Google**, Google shares your name, email address and profile picture with us.

### 2.2 Information about other people that riders give us

- **Passenger details** — if you book for someone else, their name and phone number, which we share with the driver.
- **Family members** — the name, relationship and phone number of family members you add to your profile.
- **Trusted contacts** — people you choose to share trips with or contact in an emergency. *(Pending implementation — see DEVLOG 2026-10-06)*

Only add someone's details if they know and agree.

### 2.3 Additional information from drivers

| Information | Why |
|---|---|
| Operating state (currently FCT only) | To confirm where you will drive |
| Selfie photo | To confirm your identity; it is also shown to riders as your profile photo |
| Driver's licence (photo of the front) | To confirm you are licensed to drive |
| National Identification Number (NIN) slip or National ID card (photo) | To confirm your identity |
| Vehicle details: category, plate number, make, model, year, colour | To show riders what to look for and to check the vehicle |
| Vehicle photos: exterior with plate, front and rear interior | To check the vehicle's condition and identity |
| Vehicle licence and roadworthiness certificate (photos) | To confirm the vehicle is licensed and roadworthy |
| Document expiry dates | To know when documents need renewing *(Pending implementation — see DEVLOG 2026-10-06)* |
| Bank name, account name and account number | To pay out your earnings. The account number is stored encrypted, and we show only the last 4 digits in the app. |
| Online/offline times | To know when you are available and to support your earnings records |

See the [Driver Document & Verification Policy](driver-verification-policy.md).

### 2.4 Location

We collect **precise location** (GPS):

- **Riders:** when the app is open and you are setting up a ride, to set your pickup point, show nearby drivers and show your position on the map. We store the pickup and drop-off locations of each ride and any places you save. We do not collect rider location in the background.
- **Drivers:** continuously **while you are online** — roughly every few seconds — so we can show you to riders, send you nearby requests and show your progress to your rider during a trip. We store only your **latest** position, not a history of your movements. When you go offline, location updates stop. **BUSINESS DECISION REQUIRED — whether drivers' location will also be collected while the app is in the background during a trip (see DEVLOG 2026-10-06, item 14). If yes, this paragraph must say so.**
- We record the time you go online and offline.

You can turn off location permission on your phone, but you will not be able to book rides (riders) or go online (drivers) without it.

### 2.5 Ride information

For each ride we keep: pickup and destination (address and coordinates), ride type, options chosen (priority, shared, scheduled time), the fare and how it was calculated, any promo code, payment method and status, the driver's location during the trip, the times the ride was requested, accepted, started, completed or cancelled, who cancelled and why, and the rider and driver involved. We also record when a driver declines a request.

### 2.6 Payment and wallet information

- **Wallet top-ups** are made through **Flutterwave**. You enter your card or bank details on Flutterwave's page, not in Pantra. **Pantra does not receive or store your card number, expiry date or CVV.** We receive the payment reference, amount, status and the method type from Flutterwave.
- We keep your **wallet balance** and transaction history (top-ups, ride payments, tips, refunds).
- We give Flutterwave your name, email address and phone number so it can process the payment.
- **Drivers:** we keep payout records, commission records and your bank details (above).
- **Riders:** if you add a bank account to your wallet, we keep the bank name, account holder name and account number. **BUSINESS DECISION REQUIRED — what rider bank details are used for, given riders cannot withdraw wallet balances. The account number must be encrypted before publishing this policy (see DEVLOG 2026-10-06).**

### 2.7 Device and technical information

- **Push notification token** — an identifier for your phone so we can send you notifications.
- **Device information** — at sign-up we may record a device identifier (Android ID or iOS identifier for vendor), device model, brand and operating system, to prevent fraud such as repeated sign-ups. **BUSINESS DECISION REQUIRED — confirm this is wanted; the code currently tries to save it but the storage may not exist.**
- **Advertising identifier** — collected by Google AdMob when ads are shown (section 4).
- **Sign-in session** — stored on your phone so you stay logged in.

We **do not** use analytics or crash-reporting tools, and we do not store your IP address in our own database. Our hosting and service providers may log IP addresses as part of normal operation. **LEGAL REVIEW REQUIRED — confirm provider logging.**

### 2.8 Rewards and promotions

We keep your reward points balance and history (including points earned by watching ads and tasks completed), and which promo codes you have used.

### 2.9 Your preferences

We keep your privacy, safety and communication settings (for example, whether you allow personalised ads).

## 3. How we use your information

We use your information to:

1. **Create and manage your account** — sign-up, sign-in, email verification, password reset.
2. **Provide rides** — show nearby drivers, send requests to drivers, match a driver, show both sides each other's details and location, navigate, complete the trip.
3. **Calculate fares and process payments** — fares, wallet top-ups, ride payments, tips, refunds, driver earnings, commission and payouts.
4. **Verify drivers** — check identity, licence and vehicle documents before a driver can go online.
5. **Keep people safe and prevent fraud** — investigate incidents, enforce our policies, detect fake accounts and payment abuse.
6. **Provide support** — respond to your requests and complaints.
7. **Send notifications** — ride updates, payment confirmations, verification decisions, reminders for scheduled rides.
8. **Run rewards and promotions** — promo codes, reward points, rewarded ads.
9. **Show ads** — on some screens (section 4).
10. **Show the weather** on the home screen, based on your approximate location.
11. **Comply with the law** and respond to lawful requests.
12. **Improve the service** — for example, reviewing support tickets and ratings to fix problems.

**LEGAL REVIEW REQUIRED — map each purpose to a lawful basis under the NDPA (contract, consent, legal obligation, legitimate interest).**

## 4. Advertising

Pantra shows ads from **Google AdMob**: a banner ad on some screens, and optional "rewarded" video ads that riders can watch to earn reward points. Google may collect your device's advertising identifier and information about your device and ad interactions, and may use it to show you personalised ads, in line with Google's own privacy policy.

You can turn off personalised ads in **Account → Privacy**, and we will then ask Google to show non-personalised ads. *(Pending implementation — see DEVLOG 2026-10-06)* You can also reset or limit your advertising ID in your phone's settings.

**LEGAL REVIEW REQUIRED — consent requirements for ad personalisation, and Apple App Tracking Transparency for iOS.**

## 5. Who we share your information with

We do not sell your personal information.

**Between riders and drivers on a ride**

| The driver sees about the rider | The rider sees about the driver |
|---|---|
| Name (or the passenger's name if booking for someone else) | Name and photo |
| Phone number (to call or message) | Phone number (to call or message) |
| Pickup point and destination | Vehicle make, model, colour and plate number |
| Rider rating | Driver rating |
| | Driver's live location until the trip ends |

Drivers who are online see new ride requests — including pickup and destination — before they accept them. **BUSINESS DECISION / IMPLEMENTATION REQUIRED — the rider's name and phone number should only be visible to the driver who accepts the ride. Today they can be seen by any registered driver, and driver profiles can be read by anyone (see DEVLOG 2026-10-06, security issues). This must be fixed before this policy is published.**

**Service providers** (they process data for us to run Pantra):

| Provider | What they do | What they receive |
|---|---|---|
| Supabase | Database, login, file storage, real-time updates | All account, ride, payment record and document data we hold |
| Vercel | Hosts our server and website | Data passing through our server |
| Google (Maps Platform) | Maps, address search, directions, distance | Locations, addresses and searches |
| Google (Sign-In) | Sign in with Google | Your Google account details (if you use it) |
| Google (AdMob) | Ads and rewarded ads | Device and advertising identifiers, ad interactions |
| Flutterwave | Wallet top-ups, commission payments, driver payouts | Name, email, phone, amount; drivers' bank details for payouts |
| Expo | Push notifications and app updates | Push token and notification content (for example, a pickup address) |
| Open-Meteo | Weather on the home screen | Approximate location coordinates |
| Groq and Anthropic | AI assistant used by Pantra staff for administration (see below) | Account, trip, support, driver verification and payout information |

**AI-assisted administration.** Pantra staff use an AI assistant to help review driver applications, support tickets, trips and payouts. To do this, the assistant may process names, contact details, trip details, support messages, driver verification information and payout details (bank name, account name and last 4 digits — never the full account number or document images). The assistant cannot make changes by itself — every action must be approved by a member of staff. **LEGAL REVIEW REQUIRED — this disclosure, the providers' data-use terms, and whether rider/driver consent or a data processing agreement is needed.**

**Pantra staff.** Authorised staff can see account, ride, payment, support and driver verification information when they need it to run the service — for example to verify a driver, handle a complaint, process a refund or pay a driver.

**Legal and safety.** We may share information with the police, courts, regulators or other authorities when the law requires it, or when we reasonably believe it is needed to protect someone's safety or to investigate fraud.

**Business transfer.** If Pantra is sold or merged, your information may pass to the new owner, who must respect this policy. **LEGAL REVIEW REQUIRED.**

## 6. Where your information is processed

Our service providers may store or process your information outside Nigeria. **BUSINESS DECISION REQUIRED — confirm the server regions of our database and hosting providers.** **LEGAL REVIEW REQUIRED — the NDPA conditions for transfers outside Nigeria and which safeguards Pantra relies on.**

## 7. How long we keep your information

**BUSINESS DECISION REQUIRED — Pantra has not yet set retention periods.** The old in-app policy stated 7 years for ride and transaction records; that is not implemented and has been removed from this draft until it is confirmed.

What happens today:
- A driver's live location is overwritten each time it updates; we do not keep a location history.
- Everything else is kept while your account exists. There is no automatic deletion yet.

Recommended decisions for the owner and lawyer (to be filled in):

| Data | Proposed period | Decision |
|---|---|---|
| Account profile | Until account deletion | **BUSINESS DECISION REQUIRED** |
| Ride history | ___ years after the ride | **BUSINESS DECISION REQUIRED** |
| Payment, wallet, payout and commission records | ___ years (tax/accounting law) | **BUSINESS DECISION REQUIRED** |
| Driver documents | ___ after the driver leaves or is rejected | **BUSINESS DECISION REQUIRED** |
| Messages | ___ after the ride | **BUSINESS DECISION REQUIRED** |
| Support tickets | ___ after closure | **BUSINESS DECISION REQUIRED** |
| Ratings | ___ | **BUSINESS DECISION REQUIRED** |

## 8. How we protect your information

- Database access rules so users can only reach the data they need.
- Driver documents are kept in private storage. Staff view them through links that expire after one hour.
- Drivers' bank account numbers are encrypted.
- Passwords are handled by our login provider and are never visible to Pantra.
- Payment confirmations from Flutterwave are verified directly with Flutterwave before money is credited.
- Admin actions such as driver verification decisions and payouts are recorded.

No system is completely secure. If a breach affects your information, we will notify you and the authorities as the law requires. **LEGAL REVIEW REQUIRED — breach notification duties under the NDPA.**

## 9. Your rights and choices

**LEGAL REVIEW REQUIRED — confirm the rights available under the NDPA and how Pantra will meet them.** Subject to that review, you can ask us to:

- give you a copy of your information — you can also download it from **Account → Privacy → Download Your Data** *(Pending implementation — see DEVLOG 2026-10-06)*;
- correct information that is wrong — you can edit most profile details yourself;
- delete your information — see the [Account Deletion & Data Request Guide](account-deletion-policy.md);
- stop using your information for a particular purpose, or withdraw consent (for example, personalised ads);
- complain to the Nigeria Data Protection Commission.

Other choices: you can change location, camera, photo and notification permissions in your phone's settings, and choose your privacy and communication settings in the app. *(Saving communication preferences: pending implementation — see DEVLOG 2026-10-06)*

To make a request, contact us (section 12). We may need to confirm your identity first. **BUSINESS DECISION REQUIRED — response time for requests.**

## 10. Children

Pantra is for people aged **18 and over**. **CONFIRM — taken from existing in-app terms.** We do not knowingly create accounts for anyone younger. If you think a child has an account, contact us and we will delete it.

**BUSINESS DECISION REQUIRED — whether an adult may book a ride for a child travelling alone, or with an adult. If so, we will receive the child's name if the booker enters it.**

## 11. Changes to this policy

We will update this policy when our practices change. When we make an important change, we will tell you in the app and, where the law requires, ask for your consent again. *(Pending implementation — see DEVLOG 2026-10-06)*

## 12. Contact

- **In the app:** Help & Support → Report an Issue
- **Email:** pantrateam@gmail.com — **CONFIRM — taken from existing in-app terms**
- **Phone:** +234 916 432 9554 — **CONFIRM — taken from the in-app support screen**
- **Data Protection Officer:** **BUSINESS DECISION REQUIRED**
- **Address:** **BUSINESS DECISION REQUIRED**
