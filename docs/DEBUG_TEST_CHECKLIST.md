# Debug Test Checklist - Pantra Ride App

## 🎯 Quick Test Guide

### Step 1: Start the App
```bash
npx expo start --clear
```

**Expected:** Server starts without errors

---

## 🧪 Test Cases

### ✅ Test 1: App Launches Successfully
**Steps:**
1. Start Expo server
2. Scan QR code with Expo Go (or press 'w' for web)
3. Wait for app to load

**Expected Results:**
- ✅ No error screens
- ✅ Shows loading screen briefly
- ✅ Redirects to role selection screen (if not logged in)
- ✅ Console shows: "Index: Checking authentication state"

**Status:** ____________

---

### ✅ Test 2: Google Auth Configuration
**Steps:**
1. Check console logs when app starts

**Expected Results:**
- ✅ Console shows: "Google Client IDs: { android: 'Set', ios: 'Set', web: 'Set', platform: '...' }"
- ✅ No errors about missing Client IDs

**Status:** ____________

---

### ✅ Test 3: User Registration Flow
**Steps:**
1. From role selection, tap "I'm a Rider"
2. Tap "Sign Up"
3. Fill in:
   - Name: Test User
   - Email: test@example.com
   - Phone: +234 123 456 7890
   - Password: password123
4. Tap Sign Up

**Expected Results:**
- ✅ Shows loading state
- ✅ Redirects to complete profile (missing photo)
- ✅ Can skip or add photo
- ✅ Console shows: "Auth Store: User logged in successfully"

**Status:** ____________

---

### ✅ Test 4: User Login Flow
**Steps:**
1. Logout if logged in
2. Navigate to Login
3. Enter:
   - Email: any email
   - Password: any password
4. Tap Login

**Expected Results:**
- ✅ Shows loading state
- ✅ Redirects to home screen
- ✅ Can see map
- ✅ Console shows: "Auth Store: User logged in successfully"

**Status:** ____________

---

### ✅ Test 5: Google Login Button
**Steps:**
1. Navigate to Login screen
2. Look for "Continue with Google" button
3. Tap the button

**Expected Results:**
- ✅ Button is visible
- ✅ Opens Google authentication screen (not an error)
- ✅ Can see Google login page

**Status:** ____________

**Note:** Actual login may fail if redirect URIs aren't configured in Google Cloud Console

---

### ✅ Test 6: Phone Login Flow
**Steps:**
1. Navigate to Login screen
2. Tap "Login with Phone"
3. Enter any phone number
4. Tap "Send Code"
5. Enter verification code: `123456`
6. Tap "Verify"

**Expected Results:**
- ✅ Shows code sent message
- ✅ Can enter verification code
- ✅ Successfully logs in with code 123456
- ✅ Redirects to home screen

**Status:** ____________

---

### ✅ Test 7: Home Screen Map
**Steps:**
1. Login as user
2. View home screen

**Expected Results:**
- ✅ Map displays correctly
- ✅ Shows current location (blue dot)
- ✅ "Where to?" search bar visible
- ✅ Weather toggle button visible
- ✅ Console shows: "Getting your location..."

**Status:** ____________

**Platform-Specific:**
- iOS/Android: Native Google Maps
- Web: Custom web map implementation

---

### ✅ Test 8: Navigation Between Tabs
**Steps:**
1. Login as user
2. Navigate between tabs:
   - Home
   - Rides
   - Earn
   - Discover
   - Account

**Expected Results:**
- ✅ All tabs are clickable
- ✅ Each tab loads without errors
- ✅ Tab icons display correctly
- ✅ No console errors

**Status:** ____________

---

### ✅ Test 9: Driver Login Flow
**Steps:**
1. Logout
2. From role selection, tap "I'm a Driver"
3. Enter credentials (any email/password)
4. Tap Login

**Expected Results:**
- ✅ Shows loading state
- ✅ Redirects to driver dashboard
- ✅ Console shows: "Driver Auth Store: Login completed successfully"
- ✅ Can see driver-specific tabs

**Status:** ____________

---

### ✅ Test 10: Driver Dashboard
**Steps:**
1. Login as driver
2. View dashboard

**Expected Results:**
- ✅ Shows earnings summary
- ✅ Shows trip count
- ✅ Shows online/offline toggle
- ✅ No errors in console

**Status:** ____________

---

### ✅ Test 11: Search for Destination
**Steps:**
1. Login as user
2. Tap "Where to?" search bar
3. Search for a location

**Expected Results:**
- ✅ Opens search screen
- ✅ Can type in search bar
- ✅ Shows recent locations
- ✅ Can select a destination

**Status:** ____________

---

### ✅ Test 12: Ride Booking Flow
**Steps:**
1. Login as user
2. Set pickup and destination
3. Select ride type
4. Confirm ride

**Expected Results:**
- ✅ Shows ride types (Economy, Premium, etc.)
- ✅ Shows price estimates
- ✅ Can confirm ride
- ✅ Navigates to ride progress

**Status:** ____________

---

### ✅ Test 13: Theme Switching
**Steps:**
1. Navigate to Account tab
2. Find theme toggle (if available)
3. Toggle between light and dark mode

**Expected Results:**
- ✅ Theme changes immediately
- ✅ All colors update correctly
- ✅ No visual glitches

**Status:** ____________

---

### ✅ Test 14: Weather Feature
**Steps:**
1. Login as user
2. On home screen, tap weather icon
3. View weather card

**Expected Results:**
- ✅ Weather card appears
- ✅ Shows temperature and conditions
- ✅ Shows city name
- ✅ Can close weather card

**Status:** ____________

---

### ✅ Test 15: Backend Connection
**Steps:**
1. Navigate to backend test screen (if available)
2. Or check console for backend logs

**Expected Results:**
- ✅ Backend URL is configured
- ✅ tRPC client initializes
- ✅ No connection errors

**Status:** ____________

---

## 🔍 Console Log Checks

### Expected Console Logs (Good Signs)
- ✅ "Google Client IDs: Set"
- ✅ "Index: Checking authentication state"
- ✅ "Auth Store: User logged in successfully"
- ✅ "Driver Auth Store: Login completed successfully"
- ✅ "Getting your location..."

### Error Logs to Watch For (Bad Signs)
- ❌ "Client Id property `androidClientId` must be defined"
- ❌ "Error loading stored user"
- ❌ "Firebase: Error"
- ❌ "Network request failed"
- ❌ "Google auth error"

---

## 🚨 Common Issues & Solutions

### Issue 1: Google Auth Error
**Error:** "Client Id property `androidClientId` must be defined"

**Solution:**
1. Check `.env` file has all Google client IDs
2. Restart Expo with clear cache: `npx expo start --clear`
3. Verify hardcoded fallbacks in `hooks/useAuthStore.ts`

**Fixed:** YES (Hardcoded fallbacks added)

---

### Issue 2: Map Not Displaying
**Error:** Blank screen where map should be

**Solution:**
1. Check Google Maps API key in `.env`
2. Verify API key is enabled in Google Cloud Console
3. On web, check if `Map.web.tsx` is being used
4. Check console for map-related errors

---

### Issue 3: Location Permission Denied
**Error:** "Location permission denied"

**Solution:**
1. Grant location permission in device settings
2. Restart app
3. On web, allow location in browser

---

### Issue 4: Navigation Error
**Error:** "No route found"

**Solution:**
1. Check file structure in `app/` folder
2. Verify `_layout.tsx` files exist
3. Restart Expo server

---

### Issue 5: Firebase Errors
**Error:** Firebase initialization errors

**Solution:**
1. Firebase is optional - the app uses mock data
2. Update Firebase config in `.env` only if you're using Firebase
3. If not using Firebase, you can ignore these errors

---

## 📊 Test Results Summary

| Test # | Test Name | Status | Notes |
|--------|-----------|--------|-------|
| 1 | App Launch | ⬜ | |
| 2 | Google Auth Config | ⬜ | |
| 3 | User Registration | ⬜ | |
| 4 | User Login | ⬜ | |
| 5 | Google Login Button | ⬜ | |
| 6 | Phone Login | ⬜ | |
| 7 | Home Screen Map | ⬜ | |
| 8 | Tab Navigation | ⬜ | |
| 9 | Driver Login | ⬜ | |
| 10 | Driver Dashboard | ⬜ | |
| 11 | Search Destination | ⬜ | |
| 12 | Ride Booking | ⬜ | |
| 13 | Theme Switching | ⬜ | |
| 14 | Weather Feature | ⬜ | |
| 15 | Backend Connection | ⬜ | |

**Legend:** ✅ Passed | ❌ Failed | ⬜ Not Tested

---

## 🎉 Success Criteria

The app is considered **fully debugged and working** if:

1. ✅ App launches without errors
2. ✅ Can register and login as user
3. ✅ Can login as driver
4. ✅ Map displays on home screen
5. ✅ Can navigate between tabs
6. ✅ No critical console errors
7. ✅ Google login button appears (actual login may need Google Cloud setup)
8. ✅ Phone login works with code 123456

---

## 📝 Notes Section

**Tester Name:** ___________________  
**Date:** ___________________  
**Platform Tested:** ⬜ iOS  ⬜ Android  ⬜ Web  
**Expo Go Version:** ___________________

**Additional Notes:**
________________________________________
________________________________________
________________________________________
________________________________________

---

## 🔄 Next Steps After Testing

### If All Tests Pass ✅
1. Configure Google OAuth redirect URIs (see FULL_DEBUG_REPORT.md)
2. Connect to real backend APIs
3. Test on physical devices
4. Performance optimization
5. Production deployment preparation

### If Tests Fail ❌
1. Note which tests failed
2. Check console logs for specific errors
3. Review FULL_DEBUG_REPORT.md for solutions
4. Check TROUBLESHOOTING section below

---

## 🆘 TROUBLESHOOTING

### App Won't Start
```bash
# Clear all caches
npx expo start --clear

# Reinstall dependencies
rm -rf node_modules
npm install

# Check for port conflicts
# Try different port
npx expo start --port 8082
```

### Still Getting Errors
1. Check `.env` file exists and has correct format
2. Verify all files are saved
3. Check for TypeScript errors: `npx tsc --noEmit`
4. Review error boundary logs
5. Check network connectivity

---

**Generated:** 2025-11-06  
**App:** Pantra Ride App v1.0.0  
**Expo SDK:** 54.0.21
