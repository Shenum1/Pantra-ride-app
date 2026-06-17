# 🚀 Complete Setup Guide for Your Ride-Sharing App

## 📋 Table of Contents
1. [Firebase Setup](#firebase-setup)
2. [Google Authentication Setup](#google-authentication-setup)
3. [Phone Authentication Setup](#phone-authentication-setup)
4. [Google Maps API Setup](#google-maps-api-setup)
5. [Environment Variables](#environment-variables)
6. [Admin Panel Access](#admin-panel-access)

---

## 🔥 Firebase Setup

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "my-ride-app")
4. Disable Google Analytics (optional)
5. Click "Create project"

### Step 2: Register Your App
1. In Firebase Console, click the **Web icon** (`</>`)
2. Register app nickname: "Ride App Web"
3. Check "Also set up Firebase Hosting" (optional)
4. Click "Register app"
5. **Copy the Firebase config** - you'll need these values!

```javascript
// Your Firebase config will look like this:
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "my-ride-app.firebaseapp.com",
  projectId: "my-ride-app",
  storageBucket: "my-ride-app.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

### Step 3: Enable Authentication Methods
1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable these providers:
   - ✅ **Email/Password** - Click Enable → Save
   - ✅ **Google** - Click Enable → Save
   - ✅ **Phone** - Click Enable → Save

### Step 4: Set Up Firestore Database
1. Go to **Firestore Database** → Click "Create database"
2. Choose **Start in test mode** (for development)
3. Select your region (closest to your users)
4. Click "Enable"

**Important:** Update security rules later for production:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /rides/{rideId} {
      allow read, write: if request.auth != null;
    }
    match /drivers/{driverId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == driverId;
    }
  }
}
```

### Step 5: Set Up Storage
1. Go to **Storage** → Click "Get started"
2. Choose **Start in test mode**
3. Click "Next" → "Done"

**Important:** Update storage rules for production:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /drivers/{driverId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == driverId;
    }
  }
}
```

---

## 🔐 Google Authentication Setup

### Step 1: Get OAuth Client IDs
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project (or create new one)
3. Go to **APIs & Services** → **Credentials**

### Step 2: Create Web Client ID
1. Click **Create Credentials** → **OAuth client ID**
2. Choose **Web application**
3. Name: "Ride App Web"
4. Add Authorized JavaScript origins:
   - `http://localhost:8081`
   - `https://your-app-domain.com`
5. Add Authorized redirect URIs:
   - `http://localhost:8081/__/auth/handler`
   - `https://your-app-domain.com/__/auth/handler`
6. Click **Create**
7. **Copy the Client ID** - you'll need this!

### Step 3: Create iOS Client ID (if deploying to iOS)
1. Click **Create Credentials** → **OAuth client ID**
2. Choose **iOS**
3. Name: "Ride App iOS"
4. Bundle ID: Your app's bundle ID (from app.json)
5. Click **Create**
6. **Copy the Client ID**

### Step 4: Create Android Client ID (if deploying to Android)
1. Click **Create Credentials** → **OAuth client ID**
2. Choose **Android**
3. Name: "Ride App Android"
4. Package name: Your app's package name (from app.json)
5. Get SHA-1 certificate fingerprint:
   ```bash
   # For development
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```
6. Paste SHA-1 fingerprint
7. Click **Create**
8. **Copy the Client ID**

---

## 📱 Phone Authentication Setup

### Step 1: Enable Phone Auth in Firebase
Already done in Firebase Setup Step 3!

### Step 2: Configure reCAPTCHA (for Web)
1. Go to [Google reCAPTCHA](https://www.google.com/recaptcha/admin)
2. Click **+** to create new site
3. Label: "Ride App"
4. reCAPTCHA type: **reCAPTCHA v2** → "I'm not a robot"
5. Domains: Add your domains
   - `localhost`
   - `your-app-domain.com`
6. Click **Submit**
7. **Copy Site Key and Secret Key**

### Step 3: Test Phone Numbers (Optional for Development)
1. In Firebase Console → **Authentication** → **Sign-in method**
2. Scroll to **Phone** → Click pencil icon
3. Add test phone numbers:
   - Phone: `+1 555-555-5555`
   - Code: `123456`
4. Click **Save**

---

## 🗺️ Google Maps API Setup

### Step 1: Enable APIs
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **Library**
4. Search and enable these APIs:
   - ✅ **Maps JavaScript API**
   - ✅ **Maps SDK for Android** (if using Android)
   - ✅ **Maps SDK for iOS** (if using iOS)
   - ✅ **Places API**
   - ✅ **Directions API**
   - ✅ **Distance Matrix API**
   - ✅ **Geocoding API**

### Step 2: Create API Key
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **API key**
3. **Copy the API key**
4. Click **Restrict Key** (recommended)
5. Name: "Ride App Maps Key"
6. Application restrictions:
   - For web: **HTTP referrers**
     - Add: `http://localhost:8081/*`
     - Add: `https://your-domain.com/*`
   - For mobile: **Android apps** or **iOS apps**
     - Add your package name/bundle ID
7. API restrictions: **Restrict key**
   - Select all the APIs you enabled above
8. Click **Save**

---

## 🔧 Environment Variables

### Step 1: Create .env file
Create a `.env` file in your project root:

```bash
# Copy from .env.example
cp .env.example .env
```

### Step 2: Fill in Your Values
Edit `.env` with your actual values:

```env
# Firebase Configuration (from Firebase Console)
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=my-ride-app.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=my-ride-app
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=my-ride-app.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# Google OAuth (from Google Cloud Console)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnop.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789012-iosabcdefg.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=123456789012-androidabc.apps.googleusercontent.com

# Google Maps API (from Google Cloud Console)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### Step 3: Restart Your App
```bash
# Stop the current server (Ctrl+C)
# Start again
npm start
```

---

## 👨‍💼 Admin Panel Access

### Option 1: Web-Only Admin Panel (Recommended)
Your admin panel is already set up at `admin-web/index.html`

**To access:**
1. Start the admin server:
   ```bash
   node admin-server.js
   ```
2. Open browser: `http://localhost:3001`
3. Login with admin credentials

**Default admin credentials:**
- Email: `admin@rideapp.com`
- Password: `admin123`

### Option 2: In-App Admin Panel
Access from the mobile app:
1. Open app
2. Go to `/admin` route
3. Login with admin credentials

---

## ✅ Verification Checklist

Before going to production, verify:

- [ ] Firebase project created
- [ ] Authentication methods enabled (Email, Google, Phone)
- [ ] Firestore database created with security rules
- [ ] Storage enabled with security rules
- [ ] Google OAuth client IDs created (Web, iOS, Android)
- [ ] Google Maps APIs enabled
- [ ] API keys created and restricted
- [ ] Environment variables configured
- [ ] Admin panel accessible
- [ ] Test authentication flows work
- [ ] Test database read/write works
- [ ] Test file upload works
- [ ] Maps display correctly

---

## 🆘 Troubleshooting

### Firebase Auth Not Working
- Check if authentication methods are enabled in Firebase Console
- Verify environment variables are correct
- Check browser console for errors

### Google Sign In Fails
- Verify OAuth client IDs are correct
- Check authorized domains in Google Cloud Console
- Make sure redirect URIs are configured

### Maps Not Showing
- Verify Google Maps API key is correct
- Check if required APIs are enabled
- Look for API key restrictions

### Admin Panel Not Loading
- Make sure admin server is running: `node admin-server.js`
- Check port 3001 is not in use
- Verify admin credentials

---

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Google Maps Platform](https://developers.google.com/maps)
- [Expo Authentication](https://docs.expo.dev/guides/authentication/)
- [React Native Firebase](https://rnfirebase.io/)

---

## 🎉 You're All Set!

Your ride-sharing app now has:
- ✅ User authentication (Email, Google, Phone)
- ✅ Real-time database (Firestore)
- ✅ File storage (Firebase Storage)
- ✅ Maps integration (Google Maps)
- ✅ Admin panel for management

Start building amazing features! 🚀
