# Google Authentication Setup Guide

## ✅ What's Already Done
1. **Package name updated**: `app.rork.pantra-ride-app` ✅
2. **iOS Client ID added**: `206676668811-7cvel1a4sjljl7gb0m0oi8maj4getka0.apps.googleusercontent.com` ✅
3. **Code updated**: The app now uses the correct client IDs for Expo Go ✅
4. **Expo username**: `pylife72` ✅

## ❌ What You Need to Do

### Step 1: Create Android Client ID for Expo Go

1. Go to: **https://console.cloud.google.com/**
2. Select your Google Cloud project
3. Click **"Credentials"** in the left menu
4. Click **"+ CREATE CREDENTIALS"** at the top
5. Choose **"OAuth client ID"**
6. For **"Application type"**, select **"Android"**
7. Give it a name: `Expo Go Android`
8. For **"Package name"**, enter: `host.exp.exponent`
9. For **"SHA-1 certificate fingerprint"**, enter: `A5:30:F6:46:34:BC:59:1F:1C:6B:F3:56:FE:F4:9F:72:21:0D:2A:54`
10. Click **"CREATE"**
11. **Copy the Client ID** (looks like: `123456-xxxxxxx.apps.googleusercontent.com`)

### Step 2: Add Android Client ID to Your .env File

1. Open the `.env` file in your project
2. Find this line: `EXPO_PUBLIC_GOOGLE_EXPO_GO_ANDROID_CLIENT_ID=YOUR_ANDROID_CLIENT_ID_HERE`
3. Replace `YOUR_ANDROID_CLIENT_ID_HERE` with the Client ID you copied in Step 1
4. Save the file

### Step 3: Restart Your App

1. Stop the development server (Press Ctrl+C in the terminal)
2. Restart it by running: `bun start` or `npm start`
3. Scan the QR code with Expo Go on your phone
4. Try "Continue with Google" again

## 🔑 Your Current Credentials

### iOS Client ID (for Expo Go)
```
206676668811-7cvel1a4sjljl7gb0m0oi8maj4getka0.apps.googleusercontent.com
```

### Android Client ID (for Expo Go)
```
TO BE ADDED - Follow Step 1 above
```

### Package Name
```
app.rork.pantra-ride-app
```

### Expo Username
```
pylife72
```

### Redirect URI
```
https://auth.expo.io/@pylife72/pantra-ride-app
```

## ⚠️ Important Notes

- The **package name** `host.exp.exponent` is correct for Expo Go (not your app's package name)
- The **SHA-1 fingerprint** is the official Expo Go fingerprint
- After adding the Android Client ID, you must restart your app
- Google auth will only work on physical devices with Expo Go installed
- Make sure you're using the same Google Cloud project for all credentials

## 🆘 Troubleshooting

### If you still get "404 error":
- Make sure the redirect URI is added in Google Cloud Console: `https://auth.expo.io/@pylife72/pantra-ride-app`
- Check that your Android Client ID is saved correctly in the `.env` file
- Restart the development server after updating `.env`

### If you get "Client Id property error":
- Double-check that the Android Client ID line in `.env` doesn't have any extra spaces
- Make sure the `.env` file is saved
- Restart the development server

## 📞 Need More Help?

If you're still stuck after following these steps, please share:
1. The exact error message you see
2. A screenshot of your `.env` file (hide the actual values)
3. Which platform you're testing on (iOS or Android)
