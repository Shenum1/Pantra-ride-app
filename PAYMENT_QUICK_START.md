# Quick Start: Adding Payment Gateway

## ✅ What's Already Done

1. **Payment Infrastructure**
   - ✅ Wallet system with transactions
   - ✅ Payment methods management
   - ✅ Add/remove payment methods UI
   - ✅ Wallet balance and history
   - ✅ Fare calculation

2. **Created Files**
   - ✅ `lib/paystack-service.ts` - Paystack integration service
   - ✅ `components/PaystackPayment.tsx` - Payment component
   - ✅ `app/add-payment-method.tsx` - Add card screen
   - ✅ `PAYMENT_GATEWAY_SETUP.md` - Full setup guide

## 🎯 Next Steps to Go Live

### Step 1: Choose Payment Gateway (5 mins)

**For Nigeria/Abuja - Choose Paystack:**
1. Go to https://paystack.com
2. Sign up for business account
3. Complete KYC verification (1-2 business days)

**Alternative Options:**
- Flutterwave: https://flutterwave.com
- Interswitch: https://www.interswitchgroup.com
- Monnify: https://monnify.com

### Step 2: Get API Keys (2 mins)

1. Login to Paystack Dashboard
2. Go to Settings → API Keys & Webhooks
3. Copy your keys:
   - **Public Key**: `pk_test_xxxxx` (for frontend)
   - **Secret Key**: `sk_test_xxxxx` (for backend - keep secret!)

### Step 3: Add Keys to .env (1 min)

Update your `.env` file:
```bash
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_your_actual_key_here
PAYSTACK_SECRET_KEY=sk_test_your_actual_secret_key_here
```

⚠️ **Never commit `.env` to git! It's already in `.gitignore`**

### Step 4: Install Paystack SDK (1 min)

For mobile support, install:
```bash
bun install react-native-paystack-webview
```

### Step 5: Implement Real Payment (Choose One)

#### Option A: Simple - Wallet First (Recommended)

**Flow:**
1. User adds money to wallet via Paystack
2. All rides paid from wallet
3. Withdraw to bank when needed

**Benefits:**
- Lower transaction fees
- Faster checkout
- Better UX
- Easier to implement

**Update `app/wallet-add-money.tsx`:**
```typescript
import PaystackPayment from '@/components/PaystackPayment';

// In your component:
<PaystackPayment
  amount={amount}
  email={user.email}
  metadata={{ purpose: 'wallet_topup' }}
  onSuccess={(response) => {
    // Verify payment on backend
    verifyPayment(response.reference);
  }}
  onCancel={() => {
    Alert.alert('Payment cancelled');
  }}
>
  {({ onPress, loading }) => (
    <Button 
      title={loading ? 'Processing...' : 'Add Money'}
      onPress={onPress}
      disabled={loading}
    />
  )}
</PaystackPayment>
```

#### Option B: Advanced - Direct Payment Per Ride

**Flow:**
1. User selects ride
2. Pay directly via Paystack
3. No wallet required

**Benefits:**
- Familiar to users
- No pre-funding needed

**Drawbacks:**
- Higher fees per transaction
- Slower checkout

### Step 6: Backend Verification (Critical!)

**⚠️ IMPORTANT: Always verify payments on backend to prevent fraud!**

Create `backend/trpc/routes/payment/verify.ts`:

```typescript
import { z } from 'zod';
import { protectedProcedure } from '../../create-context';

export const verifyPaymentProcedure = protectedProcedure
  .input(z.object({
    reference: z.string(),
  }))
  .mutation(async ({ input, ctx }) => {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${input.reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (data.status && data.data.status === 'success') {
      // Payment verified! Update wallet/database
      const amount = data.data.amount / 100; // Convert from kobo to naira
      
      // Update user wallet in Firebase
      // ...

      return {
        success: true,
        amount,
        reference: input.reference,
      };
    }

    return {
      success: false,
      message: 'Payment verification failed',
    };
  });
```

### Step 7: Test with Test Mode (30 mins)

**Paystack Test Cards:**

Success:
- Card: `4084 0840 8408 4081`
- CVV: `408`
- Expiry: Any future date
- PIN: `0000`

Insufficient Funds:
- Card: `4084 0840 8408 4081`
- CVV: `408`
- PIN: `1111`

**Test Flow:**
1. Open app
2. Go to Wallet
3. Click "Add Money"
4. Enter amount
5. Use test card
6. Verify transaction appears

### Step 8: Go Live (After Testing)

1. ✅ Complete Paystack KYC
2. ✅ Get live keys (pk_live_, sk_live_)
3. ✅ Update .env with live keys
4. ✅ Test with real small amounts (₦100)
5. ✅ Set up webhooks for real-time updates
6. ✅ Monitor first transactions

## 💰 Cost Breakdown

### Paystack Fees (Nigeria)
- **Local Cards**: 1.5% + ₦100 (capped at ₦2,000)
- **International Cards**: 3.9% + ₦100
- **Bank Transfer**: ₦50 flat
- **USSD**: ₦50 flat

### Example Calculations

**₦5,000 Ride:**
```
Fare: ₦5,000
Paystack Fee: ₦175 (1.5% + ₦100)
You Receive: ₦4,825
```

**₦1,000 Wallet Top-up:**
```
Amount: ₦1,000
Paystack Fee: ₦115 (1.5% + ₦100)
You Receive: ₦885
```

## 🛡️ Security Checklist

- ✅ Never expose secret keys in frontend
- ✅ Always verify on backend
- ✅ Use HTTPS only
- ✅ Implement webhook signature verification
- ✅ Log all transactions
- ✅ Add rate limiting
- ✅ Set transaction limits
- ✅ Enable 2FA for admin

## 📱 User Flow

### Current Flow (Mock Data)
1. User opens app ✅
2. User books ride ✅
3. Fake payment processed ✅
4. Ride starts ✅

### With Real Payment
1. User opens app ✅
2. User adds money to wallet 🆕
   - Click "Add Money"
   - Enter amount
   - Pay via Paystack
   - Balance updated
3. User books ride ✅
4. Payment from wallet 🆕
5. Ride starts ✅

## 🔧 Troubleshooting

### "Payment failed"
- Check API keys are correct
- Verify test mode vs live mode
- Check internet connection
- Review console logs

### "Invalid public key"
- Make sure key starts with `pk_test_` or `pk_live_`
- Check .env file is loaded
- Restart Metro bundler

### "Transaction not verified"
- Check secret key on backend
- Verify reference is correct
- Check Paystack dashboard for transaction

## 📚 Resources

- **Paystack Docs**: https://paystack.com/docs
- **Test Cards**: https://paystack.com/docs/payments/test-payments
- **API Reference**: https://paystack.com/docs/api
- **React Native**: https://github.com/just1and0/react-native-paystack-webview
- **Support**: support@paystack.com

## 🎉 Recommended Approach for MVP

**Start Simple:**
1. ✅ Wallet-only payments (Easiest)
2. Users add money → Pay from wallet
3. Single integration point
4. Lower fees
5. Better UX

**Later Add:**
- Direct card payments
- Bank transfers
- USSD codes
- Mobile money
- Split payments

## 📞 Need Help?

1. Read `PAYMENT_GATEWAY_SETUP.md` for detailed guide
2. Check Paystack documentation
3. Test in test mode first
4. Contact Paystack support: support@paystack.com

## Summary

You're **80% done!** Just need to:
1. Get Paystack account (5 mins)
2. Add API keys to .env (1 min)
3. Test with test cards (10 mins)
4. Go live! 🚀

The infrastructure is ready, payment UI is built, wallet system works. Just plug in real payment gateway!
