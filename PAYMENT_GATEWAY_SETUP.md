# Payment Gateway Integration Guide

## Overview
This guide covers integrating real payment gateways into your ride-hailing app, with focus on Paystack (best for Nigeria/Abuja).

## Recommended Payment Gateways

### 1. Paystack (Recommended for Nigeria)
- **Best for:** Nigeria, Ghana, South Africa
- **Supports:** Cards, Bank Transfer, USSD, Mobile Money
- **Transaction fee:** 1.5% + ₦100 (capped at ₦2,000)
- **Settlement:** T+1 (Next day)
- **Website:** https://paystack.com

### 2. Flutterwave
- **Best for:** Pan-African coverage
- **Supports:** Cards, Bank Transfer, Mobile Money, USSD
- **Transaction fee:** 1.4% for local cards
- **Website:** https://flutterwave.com

### 3. Stripe (International)
- **Best for:** Global payments
- **Supports:** Cards, Wallets, Bank transfers
- **Transaction fee:** 3.9% + $0.30 (international)
- **Website:** https://stripe.com

## Implementation Steps

### Phase 1: Account Setup

1. **Create Paystack Account**
   - Go to https://paystack.com
   - Sign up for business account
   - Complete KYC verification
   - Get API keys from Settings > API Keys & Webhooks

2. **Get Your Keys**
   ```
   Public Key: pk_test_xxxxx (for frontend)
   Secret Key: sk_test_xxxxx (for backend - NEVER expose!)
   ```

### Phase 2: Installation

```bash
# Install Paystack React Native SDK
bun install react-native-paystack-webview

# For backend (if using Node.js/Hono)
bun install paystack-api axios
```

### Phase 3: Environment Variables

Add to your `.env` file:
```env
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx

# For production
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY_PROD=pk_live_xxxxxxxxxxxxx
PAYSTACK_SECRET_KEY_PROD=sk_live_xxxxxxxxxxxxx
```

### Phase 4: Implementation

#### A. Frontend Payment Flow (React Native)

1. **User adds money to wallet**
   - User enters amount
   - Frontend initiates Paystack payment
   - User completes payment
   - Backend verifies transaction
   - Wallet balance updated

2. **Ride Payment**
   - Calculate fare
   - Check wallet balance
   - If insufficient → redirect to add money
   - If sufficient → deduct from wallet
   - Process ride payment

#### B. Backend Verification (Critical!)

**IMPORTANT:** Always verify payments on backend to prevent fraud!

```
1. Frontend receives payment reference from Paystack
2. Frontend sends reference to your backend
3. Backend calls Paystack API to verify
4. Backend updates wallet/database only if verified
5. Backend returns success to frontend
```

### Phase 5: Payment Methods Supported

1. **Card Payments** (Visa, Mastercard, Verve)
   - Instant settlement
   - Most common method

2. **Bank Transfer**
   - Generate account number
   - User transfers from their bank
   - Auto-verification

3. **USSD**
   - Dial code from mobile
   - Works on any phone
   - No internet required

4. **Mobile Money** (Ghana, Kenya, etc.)
   - M-Pesa, MTN Mobile Money
   - Instant transfer

### Phase 6: Security Checklist

- [ ] Never expose secret keys in frontend code
- [ ] Always verify transactions on backend
- [ ] Use HTTPS for all API calls
- [ ] Implement webhook signature verification
- [ ] Log all transactions for audit trail
- [ ] Implement rate limiting
- [ ] Add transaction amount limits
- [ ] Enable 2FA for admin accounts
- [ ] Use environment variables for keys

### Phase 7: Testing

**Test Mode:**
- Use test keys (pk_test_, sk_test_)
- Use test cards provided by Paystack
- No real money charged

**Test Cards (Paystack):**
```
Success Card:
Number: 4084 0840 8408 4081
CVV: 408
Expiry: Any future date
PIN: 0000

Insufficient Funds:
Number: 4084 0840 8408 4081
CVV: 408
Pin: 1111
```

### Phase 8: Go Live Checklist

- [ ] Complete Paystack KYC verification
- [ ] Switch to live API keys
- [ ] Test with real small amounts first
- [ ] Set up webhooks for real-time updates
- [ ] Configure payout schedule
- [ ] Add customer support contact
- [ ] Implement refund process
- [ ] Set up transaction monitoring

## Architecture

```
┌─────────────────┐
│   React Native  │ (User Interface)
│   (Frontend)    │
└────────┬────────┘
         │
         │ 1. Initiate Payment
         ▼
┌─────────────────┐
│   Paystack UI   │ (Payment Gateway)
│   (Popup/Modal) │
└────────┬────────┘
         │
         │ 2. Payment Success/Reference
         ▼
┌─────────────────┐
│  Your Backend   │ (Verification)
│   (Hono/tRPC)   │
└────────┬────────┘
         │
         │ 3. Verify with Paystack API
         ▼
┌─────────────────┐
│   Paystack API  │ (Verification)
│   (Backend)     │
└────────┬────────┘
         │
         │ 4. Confirmed
         ▼
┌─────────────────┐
│   Firebase      │ (Store Transaction)
│   (Database)    │
└─────────────────┘
```

## Cost Breakdown

### Transaction Fees (Paystack Nigeria)
- Local Cards: 1.5% + ₦100 (capped at ₦2,000)
- International Cards: 3.9% + ₦100
- Bank Transfer: ₦50 flat fee
- USSD: ₦50 flat fee

### Example: ₦5,000 Ride
```
Ride Fare: ₦5,000
Paystack Fee: ₦175 (1.5% + ₦100)
You Receive: ₦4,825
```

## Files to Create/Modify

1. **Frontend:**
   - `lib/paystack-service.ts` (Paystack integration)
   - `components/PaystackPayment.tsx` (Payment UI)
   - `app/add-payment-method.tsx` (Add card screen)
   - Update `hooks/useWalletStore.ts` (Integration)

2. **Backend:**
   - `backend/trpc/routes/payment/verify.ts` (Verify payment)
   - `backend/trpc/routes/payment/initialize.ts` (Initialize payment)
   - `backend/services/paystack.ts` (Paystack API wrapper)
   - `backend/trpc/routes/payment/webhook.ts` (Handle webhooks)

3. **Environment:**
   - Update `.env` with API keys
   - Update `.env.example` with placeholder keys

## Next Steps

1. **Choose your payment gateway** (Recommended: Paystack for Nigeria)
2. **Create account and get API keys**
3. **Implement frontend payment flow**
4. **Set up backend verification**
5. **Test with test mode**
6. **Complete KYC and go live**

## Support Resources

- **Paystack Docs:** https://paystack.com/docs
- **Paystack React Native:** https://github.com/just1and0/react-native-paystack-webview
- **Flutterwave Docs:** https://developer.flutterwave.com
- **Stripe Docs:** https://stripe.com/docs

## Alternative: Wallet-First Approach

If you want to start simple:
1. Users add money to wallet (via payment gateway)
2. All rides paid from wallet
3. Automatic top-up when balance low
4. Withdraw to bank account

This reduces transaction fees and provides better UX!
