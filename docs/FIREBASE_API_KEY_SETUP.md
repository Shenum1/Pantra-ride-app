# Firebase API Key Setup Guide

## Current Issue
You're getting the error: `Firebase: Error (auth/api-key-not-valid.-please-pass-a-valid-api-key.)`

This means your Firebase API key in the `.env` file is either:
1. Invalid or expired
2. Not properly configured in Firebase Console
3. Has restricted access that's blocking your app

## Step-by-Step Fix

### Option 1: Get a Fresh API Key from Firebase Console

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Select your project: `your_firebase_project_id`

2. **Navigate to Project Settings**
   - Click the gear icon (⚙️) next to "Project Overview"
   - Select "Project settings"

3. **Go to General Tab**
   - Look for "Your apps" section
   - Find your Web app configuration
   - You'll see a config object like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY_HERE",
     authDomain: "your_project.firebaseapp.com",
     projectId: "your_firebase_project_id",
     storageBucket: "your_project.firebasestorage.app",
     messagingSenderId: "your_messaging_sender_id",
     appId: "your_firebase_app_id"
   };
   ```

4. **Copy the New API Key**
   - Copy the `apiKey` value
   - Update your `.env` file:
   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=<paste-your-new-api-key-here>
   ```

### Option 2: Check API Key Restrictions

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Select your project: `your_firebase_project_id`

2. **Navigate to APIs & Services > Credentials**
   - Find your API key in the list
   - Click on it to edit

3. **Check Application Restrictions**
   - Make sure "Application restrictions" is set to "None" for testing
   - Or add your domain/app to the allowed list

4. **Check API Restrictions**
   - Make sure these APIs are enabled:
     - Firebase Authentication API
     - Cloud Firestore API
     - Cloud Storage API
     - Identity Toolkit API

### Option 3: Create a New Firebase Project (Last Resort)

If the above doesn't work, create a fresh Firebase project:

1. **Create New Project**
   - Go to Firebase Console
   - Click "Add project"
   - Name it (e.g., "pantra-app")
   - Enable Google Analytics (optional)

2. **Add Web App**
   - Click "Web" icon (</>)
   - Register your app
   - Copy the config

3. **Enable Authentication**
   - Go to Authentication > Sign-in method
   - Enable Email/Password
   - Enable Phone (optional)
   - Enable Google (optional)

4. **Create Firestore Database**
   - Go to Firestore Database
   - Click "Create database"
   - Start in test mode (for development)
   - Choose a location

5. **Update .env File**
   - Replace all Firebase values in `.env` with new config

## Testing After Setup

1. **Restart Your Development Server**
   ```bash
   # Stop the current server (Ctrl+C)
   bun run start
   ```

2. **Clear App Cache** (if needed)
   - On your device/emulator: Clear app data
   - Or use: `expo start -c` to clear cache

3. **Try Logging In**
   - Create a new account
   - Check console for any errors

## What's Been Added

### 1. Professional Toast Notifications
All authentication actions now show professional toast messages:

- ✅ **Success Messages**
  - "Welcome back!" - On successful login
  - "Account Created!" - On successful signup
  - "Logged Out" - On logout
  - "Verification Code Sent" - On phone login

- ❌ **Error Messages**
  - "No account found with this email address"
  - "Incorrect password. Please try again"
  - "Invalid email or password"
  - "This email is already registered"
  - "Password should be at least 6 characters"
  - "Network error. Please check your connection"
  - And many more user-friendly messages

### 2. Error Parsing
Created `lib/auth-errors.ts` that:
- Converts Firebase error codes to user-friendly messages
- Handles all common authentication errors
- Provides fallback messages for unknown errors

### 3. Updated Components
- `app/login.tsx` - Uses Toast instead of Alert
- `app/signup.tsx` - Uses Toast instead of Alert
- `hooks/useAuthStore.ts` - Shows Toast on all auth actions
- `lib/auth-service.ts` - Parses errors consistently
- `app/_layout.tsx` - Added Toast component to root

## Important Notes

1. **Environment Variables**
   - Always restart your dev server after changing `.env`
   - Expo uses `EXPO_PUBLIC_` prefix for client-side variables

2. **Firebase Console Access**
   - You need to be logged in with the Google account that owns the Firebase project
   - If you don't have access, you'll need to create a new project

3. **Security**
   - Never commit real API keys to Git
   - Use Firebase Security Rules in production
   - Enable API key restrictions in production

## Need Help?

If you still have issues:
1. Check Firebase Console > Authentication > Users to see if users are being created
2. Check Browser/Mobile console for detailed error messages
3. Verify all Firebase services are enabled in Firebase Console
4. Make sure billing is enabled if using phone authentication

## Contact

If you need further assistance, provide:
- The exact error message from the console
- Your Firebase project ID
- Whether you have access to the Firebase Console for this project
