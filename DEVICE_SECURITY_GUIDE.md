# Device-Based Security for Referral Bonuses

## Overview
This system prevents referral bonus abuse by tracking device fingerprints and limiting the number of accounts and referral claims per device.

## How It Works

### 1. Device Fingerprinting
The system generates a unique fingerprint for each device using:
- **Android**: `Application.getAndroidId()`
- **iOS**: `Application.getIosIdForVendorAsync()`
- **Web**: Generated UUID stored in AsyncStorage

Additional device information collected:
- Device name
- OS name and version
- Model name
- Brand and manufacturer
- Timestamp

### 2. Security Rules
- **Maximum 1 account** can be created per device
- **Maximum 1 referral bonus** can be claimed per device
- Devices can be flagged for suspicious activity
- Flagged devices cannot claim any bonuses

### 3. Eligibility Checks
Before allowing referral bonus claims, the system checks:
1. Device hasn't been flagged
2. Device hasn't exceeded account creation limit
3. Device hasn't already claimed a referral bonus
4. No suspicious activity patterns detected

## Implementation Steps

### Step 1: Install Required Packages
```bash
bun expo install expo-device expo-application
```

### Step 2: Update Firebase Security Rules

Add these Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Device registrations - only system can write
    match /device_registrations/{deviceId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Referral claims - only system can write
    match /referral_claims/{claimId} {
      allow read: if request.auth != null && 
                     resource.data.userId == request.auth.uid;
      allow write: if request.auth != null;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Step 3: Wrap Your App with Provider

Update `app/_layout.tsx`:

```typescript
import { DeviceSecurityProvider } from '@/hooks/useDeviceSecurityStore';

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <DeviceSecurityProvider>
        <AuthProvider>
          {/* Rest of your app */}
        </AuthProvider>
      </DeviceSecurityProvider>
    </QueryClientProvider>
  );
}
```

### Step 4: Use in Signup Flow

```typescript
import { useDeviceSecurity } from '@/hooks/useDeviceSecurityStore';
import { useAuth } from '@/hooks/useAuthStore';

function SignupScreen() {
  const { registerDevice, isEligible, eligibilityMessage } = useDeviceSecurity();
  const { signup } = useAuth();
  
  const handleSignup = async (name: string, email: string, password: string) => {
    // Check eligibility first
    if (!isEligible) {
      Alert.alert('Account Creation Blocked', eligibilityMessage);
      return;
    }
    
    // Create account
    await signup(name, email, password);
    
    // Register device
    await registerDevice(user.id);
  };
}
```

### Step 5: Use in Referral Claim Flow

```typescript
import { useDeviceSecurity } from '@/hooks/useDeviceSecurityStore';

function ReferralScreen() {
  const { claimReferralBonus, checkEligibility } = useDeviceSecurity();
  const { user } = useAuth();
  
  const handleClaimBonus = async (referralCode: string) => {
    // Check eligibility
    const eligibility = await checkEligibility();
    
    if (!eligibility.eligible) {
      Alert.alert('Not Eligible', eligibility.reason);
      return;
    }
    
    // Claim bonus
    const result = await claimReferralBonus(user.id, referralCode);
    
    if (result.success) {
      Alert.alert('Success', `You received ₦${result.bonusAmount} bonus!`);
    } else {
      Alert.alert('Error', result.message);
    }
  };
}
```

## Pros and Cons

### ✅ Pros

1. **Effective Fraud Prevention**
   - Prevents users from creating multiple accounts on same device
   - Stops referral bonus abuse through device tracking
   - Detects suspicious patterns automatically

2. **User-Friendly**
   - Works silently in the background
   - No additional user input required
   - Transparent to legitimate users

3. **Cross-Platform**
   - Works on iOS, Android, and Web
   - Uses native device identifiers when available
   - Fallback for web browsers

4. **Scalable**
   - Firebase handles all data storage
   - Can track millions of devices
   - Real-time eligibility checks

5. **Auditable**
   - Complete history of device registrations
   - Track all referral claims
   - Flag suspicious devices for review

### ❌ Cons

1. **Privacy Concerns**
   - Collects device information
   - May require privacy policy updates
   - Users might be concerned about tracking

2. **False Positives**
   - Family members sharing device
   - Used device resold to new owner
   - Device factory reset scenarios

3. **Workarounds Possible**
   - Users can factory reset device
   - Use emulators with spoofed IDs
   - Use different devices

4. **Technical Limitations**
   - Web fingerprinting less reliable
   - iOS identifier changes after app reinstall
   - Android ID can be reset

5. **Maintenance Required**
   - Need to monitor flagged devices
   - Handle user appeals
   - Update detection algorithms

## Better Alternatives

### 1. **Multi-Factor Verification** (Recommended)
Combine multiple verification methods:
- Phone number verification (SMS OTP)
- Email verification
- Government ID verification (for high-value bonuses)
- Bank account verification

**Pros:**
- More reliable than device tracking
- Harder to fake
- Better user trust

**Cons:**
- More friction for users
- Higher implementation cost
- Requires third-party services

### 2. **Behavioral Analysis**
Track user behavior patterns:
- Time between account creation and referral claim
- App usage patterns
- Transaction history
- Location patterns

**Pros:**
- Catches sophisticated fraud
- Adapts to new fraud patterns
- Less intrusive

**Cons:**
- Complex to implement
- Requires ML/AI
- May have false positives

### 3. **Social Graph Analysis**
Analyze relationships between users:
- Check if referrer and referee interact
- Verify social connections
- Track referral chains

**Pros:**
- Detects organized fraud rings
- Hard to fake genuine relationships
- Scalable

**Cons:**
- Privacy concerns
- Complex implementation
- Requires social features

### 4. **Gradual Bonus Release**
Release referral bonuses over time:
- 25% on signup
- 25% after first ride
- 25% after 5 rides
- 25% after 30 days

**Pros:**
- Ensures genuine usage
- Reduces fraud incentive
- Simple to implement

**Cons:**
- Less attractive to users
- Delayed gratification
- May reduce referrals

## Recommended Approach

**Best Practice: Layered Security**

Combine multiple methods for maximum security:

1. **Device Fingerprinting** (Basic layer)
   - Catches casual abuse
   - Low friction

2. **Phone Verification** (Medium layer)
   - Verify with SMS OTP
   - One bonus per phone number

3. **Behavioral Checks** (Advanced layer)
   - Monitor usage patterns
   - Flag suspicious activity

4. **Manual Review** (Final layer)
   - Review flagged accounts
   - Human verification for edge cases

## What You Need To Do

### Immediate Actions:

1. **Install Dependencies**
   ```bash
   bun expo install expo-device expo-application
   ```

2. **Update Firebase Rules**
   - Add the security rules provided above
   - Test in Firebase Console

3. **Update Privacy Policy**
   - Disclose device information collection
   - Explain how data is used
   - Provide opt-out mechanism

4. **Integrate into Signup Flow**
   - Add device registration
   - Show eligibility messages
   - Handle blocked devices gracefully

5. **Create Admin Dashboard**
   - View flagged devices
   - Review suspicious activity
   - Manually approve/reject claims

### Optional Enhancements:

1. **Add Phone Verification**
   - Use Firebase Phone Auth
   - Require verification for bonuses

2. **Implement Rate Limiting**
   - Limit referral claims per time period
   - Prevent rapid-fire abuse

3. **Add Analytics**
   - Track fraud attempts
   - Monitor system effectiveness
   - Generate reports

4. **Create Appeal Process**
   - Allow users to contest blocks
   - Provide support contact
   - Manual review system

## Testing

Test these scenarios:

1. ✅ New device, first account → Should allow
2. ✅ Same device, second account → Should block
3. ✅ Same device, second referral → Should block
4. ✅ Flagged device → Should block all actions
5. ✅ Factory reset device → Should allow (new device ID)

## Monitoring

Track these metrics:

- Total devices registered
- Blocked account attempts
- Blocked referral claims
- Flagged devices
- False positive rate
- Appeal requests

## Support

For issues or questions:
- Check Firebase Console for errors
- Review device registration logs
- Monitor suspicious activity alerts
- Contact support: pantrateam@gmail.com
