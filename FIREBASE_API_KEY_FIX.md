# Firebase API Key Error Fix

## Problem
You're getting the error: `auth/api-key-not-valid.-please-pass-a-valid-api-key.`

This means Firebase is rejecting your API key. Here's how to fix it:

## Solution Steps

### 1. Verify Your Firebase API Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **your_firebase_project_id**
3. Click the gear icon (⚙️) next to "Project Overview"
4. Go to "Project settings"
5. Scroll down to "Your apps" section
6. Find your Web app configuration
7. Copy the **exact** API key shown there

### 2. Update Your .env File

Replace the current API key in your `.env` file:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=<YOUR_CORRECT_API_KEY_HERE>
```

Current API key in your .env: `your_firebase_api_key_here`

### 3. Check API Key Restrictions

Your API key might be restricted. To fix:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: **your_firebase_project_id**
3. Go to **APIs & Services** → **Credentials**
4. Find your **Browser key** or **API key**
5. Click on it to edit
6. Under "Application restrictions":
   - For testing: Select **None** (temporarily)
   - For production: Select **HTTP referrers** and add your domains
7. Under "API restrictions":
   - Select **Restrict key**
   - Enable these APIs:
     - Firebase Authentication API
     - Cloud Firestore API
     - Firebase Storage API
     - Identity Toolkit API
8. Click **Save**

### 4. Restart Your Development Server

After updating the `.env` file:

```bash
# Stop the current server (Ctrl+C)
# Clear cache and restart
bun start -c
```

## Alternative: Create a New Web App in Firebase

If the API key is still not working:

1. Go to Firebase Console → Project Settings
2. Scroll to "Your apps" section
3. Click "Add app" → Select Web (</>) icon
4. Register a new app with any nickname
5. Copy the new `firebaseConfig` values
6. Update all values in your `.env` file:
   - EXPO_PUBLIC_FIREBASE_API_KEY
   - EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
   - EXPO_PUBLIC_FIREBASE_PROJECT_ID
   - EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
   - EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   - EXPO_PUBLIC_FIREBASE_APP_ID

## Test Your Configuration

Try logging in with these test credentials after fixing:

**Email:** test@example.com  
**Password:** test123456

If you still get errors, check the browser console for more details.

## Common Issues

### Issue: "Service temporarily unavailable"
- **Cause:** API key is invalid or restricted
- **Fix:** Follow steps 1-3 above

### Issue: "Network error"
- **Cause:** Internet connection or Firebase services down
- **Fix:** Check your internet connection and Firebase status

### Issue: "User not found"
- **Cause:** No account exists with that email
- **Fix:** Sign up first, then log in

## Need More Help?

If you're still having issues:
1. Check the console logs for detailed error messages
2. Verify your Firebase project is active and not deleted
3. Ensure Firebase Authentication is enabled in your project
4. Make sure Email/Password sign-in is enabled under Authentication → Sign-in methods
