# Firestore Security Rules Documentation

## 📋 Overview

This document explains the comprehensive security rules for your ride-sharing app's Firestore database. These rules ensure data security, user privacy, and proper access control.

---

## 🔐 Security Principles

Our security rules follow these principles:

1. **Authentication Required**: All operations require user authentication
2. **Owner Access**: Users can only access/modify their own data
3. **Role-Based Access**: Different permissions for riders, drivers, and admins
4. **Data Validation**: Ensures required fields are present
5. **Immutable Records**: Critical data (payments, ratings) cannot be modified
6. **Privacy Protection**: Users can only see relevant conversations and messages

---

## 📚 Collection-by-Collection Rules

### 1. **Users Collection** (`/users/{userId}`)

**Purpose**: Store user profiles and account information

**Rules**:
- ✅ **Read**: Any authenticated user can read user profiles (needed for ride displays)
- ✅ **Create**: Users can create their own profile only
- ✅ **Update**: Users can only update their own profile
- ❌ **Critical Fields**: Cannot modify `uid`, `createdAt`
- ✅ **Delete**: Users can delete their own profile

**Required Fields on Create**:
- `email`
- `createdAt`

```javascript
// Example: Valid user profile
{
  "uid": "user123",
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+2348012345678",
  "createdAt": Timestamp
}
```

---

### 2. **Drivers Collection** (`/drivers/{driverId}`)

**Purpose**: Store driver profiles, vehicle info, and current status

**Rules**:
- ✅ **Read**: Any authenticated user can read driver profiles (for ride matching)
- ✅ **Create**: Users can create their own driver profile
- ✅ **Update**: Drivers can update their profile and location
- ❌ **Critical Fields**: Cannot modify `licenseNumber`, `createdAt`
- ✅ **Delete**: Drivers can delete their own profile

**Required Fields on Create**:
- `userId`
- `vehicleType`
- `licenseNumber`

```javascript
// Example: Valid driver profile
{
  "userId": "driver123",
  "vehicleType": "standard",
  "vehicleModel": "Toyota Camry",
  "vehiclePlate": "ABC-123-XY",
  "licenseNumber": "DL123456",
  "rating": 4.8,
  "totalTrips": 250,
  "status": "available",
  "currentLocation": { "lat": 9.0579, "lng": 7.4951 }
}
```

---

### 3. **Rides Collection** (`/rides/{rideId}`)

**Purpose**: Store ride requests and track ride lifecycle

**Rules**:
- ✅ **Read**: Only rider and assigned driver can read
- ✅ **Create**: Users can create ride requests (status must be 'pending')
- ✅ **Update**: Both rider and driver can update (with status validation)
- ✅ **Delete**: Only rider can delete pending rides (cancel before acceptance)

**Status Transitions** (validated):
- `pending` → `accepted` (driver only)
- `accepted` → `in-progress` (driver only)
- `in-progress` → `completed` (driver only)
- Any status → `cancelled` (rider only)

**Required Fields on Create**:
- `userId`
- `pickupLocation`
- `dropoffLocation`
- `rideType`

```javascript
// Example: Valid ride request
{
  "userId": "user123",
  "pickupLocation": {
    "lat": 9.0579,
    "lng": 7.4951,
    "address": "Wuse 2, Abuja"
  },
  "dropoffLocation": {
    "lat": 9.0765,
    "lng": 7.3986,
    "address": "Garki, Abuja"
  },
  "rideType": "standard",
  "status": "pending",
  "fare": 2500,
  "distance": 5.2,
  "duration": 15
}
```

---

### 4. **Conversations Collection** (`/conversations/{conversationId}`)

**Purpose**: Store messaging conversations between riders and drivers

**Rules**:
- ✅ **Read**: Only conversation participants (rider + driver)
- ✅ **Create**: Either rider or driver can create
- ✅ **Update**: Only participants can update (for unread counts, last message)
- ✅ **Delete**: Participants can archive/delete conversations

**Required Fields on Create**:
- `userId`
- `driverId`
- `status`

```javascript
// Example: Valid conversation
{
  "userId": "user123",
  "userName": "John Doe",
  "driverId": "driver456",
  "driverName": "Jane Smith",
  "rideId": "ride789",
  "unreadCountUser": 0,
  "unreadCountDriver": 2,
  "status": "active",
  "lastMessage": "On my way!",
  "lastMessageTime": Timestamp
}
```

---

### 5. **Messages Collection** (`/messages/{messageId}`)

**Purpose**: Store individual messages within conversations

**Rules**:
- ✅ **Read**: Only conversation participants can read
- ✅ **Create**: Only participants can send messages
- ✅ **Update**: Can only mark messages as read (no content editing)
- ❌ **Delete**: Messages cannot be deleted (message history preservation)

**Required Fields on Create**:
- `conversationId`
- `senderId`
- `senderType` ('user' or 'driver')
- `text`

```javascript
// Example: Valid message
{
  "conversationId": "conv123",
  "senderId": "user123",
  "senderType": "user",
  "text": "I'm waiting at the pickup location",
  "read": false,
  "timestamp": Timestamp
}
```

---

### 6. **Ratings Collection** (`/ratings/{ratingId}`)

**Purpose**: Store ride ratings and reviews

**Rules**:
- ✅ **Read**: Any authenticated user can read ratings
- ✅ **Create**: Only riders can rate their completed rides
- ❌ **Update**: Ratings cannot be modified (data integrity)
- ❌ **Delete**: Ratings cannot be deleted (trust and transparency)

**Validation**:
- Ride must be completed
- Rider must own the ride

**Required Fields on Create**:
- `rideId`
- `driverId`
- `userId`
- `rating` (1-5)

```javascript
// Example: Valid rating
{
  "rideId": "ride789",
  "driverId": "driver456",
  "userId": "user123",
  "rating": 5,
  "comment": "Great driver, very professional!",
  "createdAt": Timestamp
}
```

---

### 7. **Payments Collection** (`/payments/{paymentId}`)

**Purpose**: Store payment transactions for rides

**Rules**:
- ✅ **Read**: Only the user who made the payment can read
- ✅ **Create**: Users can create payment records
- ✅ **Update**: Can only update status to 'completed'
- ❌ **Delete**: Payment records cannot be deleted (audit trail)

**Required Fields on Create**:
- `userId`
- `rideId`
- `amount`
- `status`

```javascript
// Example: Valid payment
{
  "userId": "user123",
  "rideId": "ride789",
  "amount": 2500,
  "currency": "NGN",
  "method": "wallet",
  "status": "pending",
  "reference": "PAY-123456"
}
```

---

### 8. **Wallet Transactions Collection** (`/walletTransactions/{transactionId}`)

**Purpose**: Track wallet deposits, withdrawals, and balance changes

**Rules**:
- ✅ **Read**: Users can only read their own transactions
- ✅ **Create**: Users can create transactions (deposits/withdrawals)
- ✅ **Update**: Users can update their transactions
- ❌ **Delete**: Transaction history cannot be deleted (financial audit)

**Required Fields on Create**:
- `userId`
- `type` ('deposit', 'withdrawal', 'ride_payment', etc.)
- `amount`
- `status`

```javascript
// Example: Valid wallet transaction
{
  "userId": "user123",
  "type": "deposit",
  "amount": 5000,
  "status": "completed",
  "method": "bank_transfer",
  "reference": "TXN-789012",
  "balanceAfter": 12500
}
```

---

### 9. **Devices Collection** (`/devices/{deviceId}`)

**Purpose**: Track device signups to prevent signup bonus abuse

**Rules**:
- ✅ **Read**: Any authenticated user can check device records
- ✅ **Create**: Users can create device record on first signup
- ✅ **Update**: Signup count can be incremented
- ❌ **Delete**: Device records cannot be deleted (fraud prevention)

**Required Fields on Create**:
- `deviceId`
- `firstUserId`
- `signupCount`
- `createdAt`

```javascript
// Example: Valid device record
{
  "deviceId": "unique-device-id-12345",
  "firstUserId": "user123",
  "signupCount": 1,
  "lastSignupAt": Timestamp,
  "createdAt": Timestamp
}
```

**How it works**:
1. On first signup, create device record with `signupCount: 1`
2. Grant signup bonus
3. On subsequent signups from same device, increment `signupCount`
4. Don't grant signup bonus if `signupCount > 1`

---

### 10. **Promotions Collection** (`/promotions/{promoId}`)

**Purpose**: Store promotional offers and discounts

**Rules**:
- ✅ **Read**: Any authenticated user can read promotions
- ⚠️ **Write**: Currently open for testing (should be admin-only in production)

**Production TODO**: Restrict write access to admin users only

---

### 11. **Discover Places Collection** (`/discoverPlaces/{placeId}`)

**Purpose**: Store featured/popular places in the app

**Rules**:
- ✅ **Read**: Any authenticated user can read discover places
- ⚠️ **Write**: Currently open for testing (should be admin-only in production)

**Production TODO**: Restrict write access to admin users only

```javascript
// Example: Valid discover place (Abuja)
{
  "name": "Jabi Lake Mall",
  "description": "Popular shopping destination",
  "category": "shopping",
  "location": {
    "lat": 9.0643,
    "lng": 7.4579,
    "address": "Jabi, Abuja"
  },
  "imageUrl": "https://...",
  "featured": true,
  "rating": 4.5
}
```

---

### 12. **Admin Collections** (`/admin/{document=**}`)

**Purpose**: Admin-only data management

**Rules**:
- ✅ **Read/Write**: Only users with admin privileges
- **Admin Check**: Uses custom claims or UID whitelist

**Production Setup**:
1. Add admin UIDs to the rules
2. Or set up Firebase Custom Claims:
```javascript
// In Firebase Admin SDK
admin.auth().setCustomUserClaims(uid, { admin: true });
```

---

### 13. **Notifications Collection** (`/notifications/{notificationId}`)

**Purpose**: Store in-app notifications for users

**Rules**:
- ✅ **Read**: Users can read their own notifications
- ✅ **Create**: System creates notifications (via Cloud Functions)
- ✅ **Update**: Users can mark as read
- ✅ **Delete**: Users can delete their notifications

```javascript
// Example: Valid notification
{
  "userId": "user123",
  "type": "ride_accepted",
  "title": "Driver Found!",
  "message": "Jane is on the way to pick you up",
  "read": false,
  "data": {
    "rideId": "ride789",
    "driverId": "driver456"
  },
  "createdAt": Timestamp
}
```

---

## 🚀 Deployment Instructions

### Option 1: Firebase Console (Recommended for First Time)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **your_firebase_project_id**
3. Navigate to **Firestore Database** → **Rules** tab
4. Copy the entire content from `firestore.rules` file
5. Paste into the rules editor
6. Click **Publish**

### Option 2: Firebase CLI (Recommended for Updates)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize (first time only)
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

---

## 🧪 Testing Security Rules

### Test in Firebase Console

1. Go to **Firestore Database** → **Rules** tab
2. Click **Rules Playground** button
3. Test different scenarios:

**Example Test 1**: User reading their own profile
```javascript
// Authentication: user123
// Location: /users/user123
// Operation: get
// Expected: ✅ Allow
```

**Example Test 2**: User reading another user's profile
```javascript
// Authentication: user123
// Location: /users/user456
// Operation: get
// Expected: ✅ Allow (profiles are public to authenticated users)
```

**Example Test 3**: User updating another user's profile
```javascript
// Authentication: user123
// Location: /users/user456
// Operation: update
// Expected: ❌ Deny
```

### Test in Your App

```typescript
// In your app code, test unauthorized access
try {
  await DatabaseService.update('users', 'another-user-id', {
    name: 'Hacked Name'
  });
} catch (error) {
  console.log('✅ Security rules working:', error);
  // Should see permission denied error
}
```

---

## ⚠️ Important Security Notes

### 1. **Admin Access**
- Currently using UID whitelist for admin access
- **Action Required**: Replace `['ADMIN_UID_1', 'ADMIN_UID_2']` with your actual admin UIDs
- Or implement Firebase Custom Claims for better admin management

### 2. **Test Mode Warning**
- Never use test mode rules in production
- Test mode allows unrestricted access for 30 days
- Always deploy production rules before public launch

### 3. **Rate Limiting**
- Consider implementing Cloud Functions for rate limiting
- Firestore security rules don't provide rate limiting
- Use Firebase App Check for additional protection

### 4. **Data Validation**
- Rules validate required fields exist
- Consider adding more validation (e.g., rating must be 1-5)
- Validate data types and formats

### 5. **Sensitive Data**
- Never store credit card details in Firestore
- Use Paystack/Stripe for payment processing
- Store only payment references, not full card numbers

---

## 🔧 Customization Guide

### Adding a New Collection

```javascript
// In firestore.rules
match /yourNewCollection/{docId} {
  // Define who can read
  allow read: if isAuthenticated();
  
  // Define who can write
  allow create: if isAuthenticated() && 
    request.auth.uid == request.resource.data.userId;
  
  // Define update rules
  allow update: if isOwner(resource.data.userId);
  
  // Define delete rules
  allow delete: if isOwner(resource.data.userId);
}
```

### Adding Field Validation

```javascript
allow create: if isAuthenticated() && 
  request.resource.data.keys().hasAll(['requiredField1', 'requiredField2']) &&
  request.resource.data.rating >= 1 && 
  request.resource.data.rating <= 5;
```

### Adding Role-Based Access

```javascript
function isDriver() {
  let user = get(/databases/$(database)/documents/drivers/$(request.auth.uid));
  return user.data.status != null;
}

allow update: if isDriver();
```

---

## 📊 Security Rules Best Practices

1. ✅ **Default Deny**: Start with no access, then grant specific permissions
2. ✅ **Validate Input**: Check required fields and data types
3. ✅ **Owner Access**: Users should only access their own data
4. ✅ **Immutable Data**: Critical records (payments, ratings) cannot be modified
5. ✅ **Privacy First**: Users can't see other users' private conversations
6. ✅ **Audit Trail**: Never delete financial or security records
7. ✅ **Test Thoroughly**: Use Rules Playground before deployment
8. ✅ **Monitor Usage**: Check Firebase Console for denied requests

---

## 🆘 Troubleshooting

### "Permission Denied" Errors

1. **Check Authentication**: User must be signed in
2. **Check Ownership**: User must own the resource
3. **Check Required Fields**: All required fields must be present
4. **Check Status Transitions**: Ride status changes must follow rules

### Rules Not Working

1. **Clear App Cache**: Uninstall and reinstall the app
2. **Check Rules Deployment**: Verify rules are published in Firebase Console
3. **Check Timestamps**: Ensure you're not in test mode with expired date
4. **Check Indexes**: Some queries require composite indexes

---

## 📚 Additional Resources

- [Firestore Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Rules Language Reference](https://firebase.google.com/docs/rules/rules-language)
- [Common Security Rules Patterns](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Testing Security Rules](https://firebase.google.com/docs/rules/unit-tests)

---

**Note**: These security rules are production-ready but should be reviewed and customized based on your specific requirements and business logic.
