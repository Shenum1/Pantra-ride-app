# Firebase Firestore Setup Guide

## ⚠️ Error: "Could not reach Cloud Firestore backend"

You're seeing this error because **Firestore Database** is not enabled in your Firebase project.

---

## 🔧 **Quick Fix (5 minutes)**

### **Step 1: Enable Firestore Database**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **your_firebase_project_id**
3. In the left sidebar, click on **"Firestore Database"** (Build section)
4. Click **"Create database"** button
5. Choose **"Start in test mode"** (for development)
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.time < timestamp.date(2025, 12, 31);
       }
     }
   }
   ```
6. Click **"Next"**
7. Select your **Firestore location** (choose the closest region to you, e.g., "us-central1" or "europe-west1")
8. Click **"Enable"**

⏱️ **Wait 1-2 minutes** for Firestore to be provisioned.

---

### **Step 2: Set Production Security Rules**

**IMPORTANT**: After testing, you MUST update your Firestore security rules for production.

#### **Option 1: Copy from firestore.rules file (Recommended)**

1. Open the `firestore.rules` file in your project root
2. Go to [Firebase Console](https://console.firebase.google.com)
3. Select your project
4. Go to **Firestore Database** → **Rules** tab
5. **Copy the entire content** from `firestore.rules` and paste it
6. Click **Publish**

#### **Option 2: Deploy via Firebase CLI**

```bash
# Install Firebase CLI (if not installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init firestore
# Select your project
# Use existing firestore.rules file

# Deploy security rules
firebase deploy --only firestore:rules
```

---

## ✅ **Verify Setup**

After enabling Firestore:

1. **Restart your app** (close and reopen)
2. Try to **sign up** or **log in** again
3. You should see: `Firebase initialized successfully` in the console
4. Check Firebase Console → Firestore Database → You should see a `users` collection appear after signup

---

## 🚀 **What Firestore Stores**

Your app uses Firestore to store:

- ✅ User profiles and preferences
- ✅ Ride requests and history
- ✅ Driver information and status
- ✅ Real-time location updates
- ✅ Messaging between riders and drivers
- ✅ Payment transaction records
- ✅ Ratings and reviews

---

## 📱 **Current Status**

✅ Firebase Auth is configured (working)  
⚠️ Firestore Database needs to be enabled (causing the error)  
✅ Firebase Storage is configured  
✅ Google Maps API is configured  

---

## 🆘 **Still Having Issues?**

### **Check your internet connection**
- Firestore requires a stable internet connection
- Try switching between WiFi and mobile data

### **Check Firebase Console**
- Make sure your Firebase project is active (not disabled/paused)
- Check if you have exceeded free tier limits

### **Clear app cache**
- Close and restart the app completely
- On mobile: uninstall and reinstall the app

---

## 📖 **Learn More**

- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firestore Pricing](https://firebase.google.com/pricing)

---

**Note**: The app will now continue to work with limited functionality (no data persistence) until you enable Firestore. Authentication will work, but user data won't be saved to the database.
