# Device Tracking for Sign-up Rewards

## Overview
Your app now prevents users from claiming sign-up bonuses multiple times from the same device. This helps prevent fraud and ensures fair distribution of rewards.

## How It Works

### 1. Device Fingerprinting
When a user opens the app, the system generates a unique device fingerprint based on:
- **Android**: Android ID
- **iOS**: iOS Vendor ID
- **Web**: Generated ID stored in browser storage

This fingerprint also includes:
- Device name
- OS name and version
- Device model
- Brand and manufacturer

### 2. Sign-up Process
When a user signs up:

1. The system generates or retrieves the device fingerprint
2. It checks if this device has been used to create an account before
3. If the device is new, signup proceeds normally and the device is registered
4. If the device was already used, signup is **blocked** with an error message

**Code location**: `hooks/useAuthStore.ts` - `signup()` function

### 3. Sign-up Bonus Claiming
When a user tries to claim the sign-up bonus:

1. The system checks the device fingerprint
2. It verifies the device has `accountsCreated === 0` (first account on this device)
3. If eligible, the bonus is awarded
4. If not eligible, an error is thrown: "Sign-up bonus can only be claimed once per device"

**Code location**: `hooks/useEarnStore.ts` - `completeTask()` function

## Configuration

You can customize the device tracking limits in `lib/device-security-service.ts`:

```typescript
const MAX_ACCOUNTS_PER_DEVICE = 1;  // Only 1 account per device
const MAX_REFERRAL_CLAIMS_PER_DEVICE = 1;  // Only 1 referral bonus per device
```

## Database Collections

The system uses Firebase Firestore with these collections:

### `device_registrations`
Stores device fingerprints and tracking data:
```typescript
{
  deviceFingerprint: {
    deviceId: string,
    deviceName: string,
    osName: string,
    osVersion: string,
    modelName: string,
    brand: string,
    manufacturer: string,
    timestamp: number
  },
  userId: string,
  accountsCreated: number,
  referralBonusesClaimed: number,
  isFlagged: boolean,
  flagReason?: string,
  registeredAt: timestamp
}
```

### `referral_claims`
Tracks referral bonus claims:
```typescript
{
  userId: string,
  referralCode: string,
  deviceId: string,
  bonusAmount: number,
  status: 'approved' | 'pending' | 'rejected',
  createdAt: timestamp
}
```

## Checking Eligibility

You can check if a user is eligible for sign-up bonuses:

```typescript
import { useEarn } from '@/hooks/useEarnStore';

const { checkSignupBonusEligibility } = useEarn();

const isEligible = await checkSignupBonusEligibility();
if (isEligible) {
  // User can claim sign-up bonus
} else {
  // User has already claimed from this device
}
```

## Security Features

### 1. Device Flagging
You can manually flag suspicious devices:

```typescript
await DeviceSecurityService.flagDevice(deviceId, 'Suspicious activity detected');
```

Flagged devices cannot create new accounts or claim bonuses.

### 2. Suspicious Activity Detection
The system monitors for:
- Multiple devices registered to the same account (>3)
- Excessive referral claims (>5)

```typescript
const { suspicious, reasons } = await DeviceSecurityService.detectSuspiciousActivity(userId);
```

### 3. Device History
View all activity for a device:

```typescript
const history = await DeviceSecurityService.getDeviceHistory(deviceId);
```

## User Experience

### New User
1. Opens app
2. Signs up with email/password
3. Device is registered in background
4. User automatically qualifies for sign-up bonus
5. Can claim bonus from Earn tab

### Returning User (Same Device)
1. Opens app on same device
2. Tries to create new account
3. Gets error: "This device has already been used to create an account"
4. Cannot proceed with signup

### Existing User (New Device)
1. User logs in on a different device
2. No issues - login works normally
3. Cannot claim sign-up bonus again (tied to original device)

## Testing

### Test New Device
1. Clear app storage: `AsyncStorage.clear()`
2. Clear device fingerprint: `AsyncStorage.removeItem('device_fingerprint')`
3. Sign up should work normally

### Test Used Device
1. Sign up once
2. Logout
3. Try to sign up again with different email
4. Should see error about device already being used

## Important Notes

1. **Device Reset**: If a user factory resets their device, they may be able to create a new account (device ID will change)

2. **Web Limitations**: Web device IDs can be cleared by clearing browser data, making them less reliable

3. **Privacy**: Device fingerprinting is stored locally and in your Firebase database. Ensure your privacy policy covers this

4. **Production**: In production, consider adding:
   - Server-side validation
   - IP address tracking (additional layer)
   - Phone number verification
   - Email verification
   - Manual review for suspicious patterns

## Troubleshooting

### User can't sign up on legitimate new device
- Check Firebase rules allow write access to `device_registrations`
- Verify device fingerprint is generating correctly
- Check console logs for errors

### Same device can create multiple accounts
- Ensure device fingerprint is persisting in AsyncStorage
- Verify Firebase queries are working
- Check `MAX_ACCOUNTS_PER_DEVICE` setting

### Bonus still claimable after device used
- Check earn task ID matches 'signup_bonus'
- Verify `completeTask` is being called with userId
- Check device registration was successful

## Admin Panel Integration

When you build your admin panel, add these features:

1. **Device Management Dashboard**
   - View all registered devices
   - See accounts created per device
   - Flag/unflag suspicious devices

2. **User Device History**
   - View all devices a user has used
   - See bonus claim history
   - Detect multi-accounting

3. **Fraud Detection**
   - Alert on suspicious patterns
   - Auto-flag devices exceeding limits
   - Review flagged accounts

## Next Steps

1. ✅ Device fingerprinting implemented
2. ✅ Sign-up blocking on used devices
3. ✅ Bonus claim protection
4. 🔲 Add IP address tracking (optional)
5. 🔲 Build admin dashboard for device management
6. 🔲 Add manual review system for flagged devices
7. 🔲 Implement phone number verification
8. 🔲 Add email verification before bonus claim
