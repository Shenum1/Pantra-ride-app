# 🧪 Testing Guide - Google Maps Integration

## Quick Test Plan

### 1. Test Live Location Search (Autocomplete)

#### Test Case 1: Search for "Kuwa"
**Steps:**
1. Open the app
2. Tap "Where to?" search bar
3. Type "Kuwa"
4. Wait 300ms

**Expected Result:**
- Should show autocomplete suggestions including:
  - "Kuwaiti Hospital, Lagos, Nigeria"
  - Other places starting with "Kuwa"
- Results appear within 1 second
- Loading spinner shows while fetching

**Screenshot Match:** ✅ Your screenshot shows this working!

---

#### Test Case 2: Search for "Lagos"
**Steps:**
1. Type "Lagos" in search
2. Wait for suggestions

**Expected Result:**
- Should show:
  - "Lagos Island, Lagos, Nigeria"
  - "Victoria Island, Lagos, Nigeria"
  - Other Lagos locations
- Each with location pin icon

---

#### Test Case 3: Search for "Abuja"
**Steps:**
1. Type "Abuja"
2. Wait for suggestions

**Expected Result:**
- Should show:
  - "Abuja City Centre"
  - "Central Business District, Abuja"
  - Other Abuja locations

---

### 2. Test Route Calculation

#### Test Case 4: Select a Location
**Steps:**
1. Search for "Ikeja"
2. Select "Ikeja, Lagos, Nigeria" from results
3. Observe the loading state

**Expected Result:**
- Shows loading spinner
- Fetches place details
- Calculates route from current location
- Navigates to ride confirmation screen
- Map shows:
  - 🔵 Blue polyline (route path)
  - 📍 Green marker (pickup)
  - 📍 Red marker (dropoff)

---

#### Test Case 5: Verify Distance & Duration
**Steps:**
1. After selecting a location
2. Look at the map overlay

**Expected Result:**
- Shows: "X.X km • Y min"
- Example: "5.2 km • 12 min"
- Distance matches Google Maps

---

### 3. Test Price Calculation

#### Test Case 6: Check Pricing Display
**Steps:**
1. Search for a location 5km away
2. Look at the search result

**Expected Result:**
```
Distance: 5.0 km • 10 min
Standard ₦1,250  Comfort ₦1,500
           From ₦1,250
```

**Formula Check:**
```
Base: ₦500 + (5 km × ₦150/km) = ₦1,250
Standard: ₦1,250 × 1.0 = ₦1,250 ✅
Comfort:  ₦1,250 × 1.2 = ₦1,500 ✅
```

---

#### Test Case 7: Different Distances
**Steps:**
1. Test with 10km location
2. Test with 20km location
3. Compare prices

**Expected Results:**

**5km:**
- Standard: ₦1,250
- Comfort: ₦1,500
- Premium: ₦1,875
- XL: ₦2,250

**10km:**
- Standard: ₦2,000
- Comfort: ₦2,400
- Premium: ₦3,000
- XL: ₦3,600

**20km:**
- Standard: ₦3,500
- Comfort: ₦4,200
- Premium: ₦5,250
- XL: ₦6,300

---

### 4. Test Route Visualization

#### Test Case 8: Map Shows Route
**Steps:**
1. Select any destination
2. On ride confirmation screen
3. Observe the map

**Expected Result:**
- ✅ Pickup marker visible
- ✅ Dropoff marker visible
- ✅ Blue route line connecting them
- ✅ Map auto-zooms to show both points
- ✅ Route follows roads (not straight line)

---

#### Test Case 9: Route Path Accuracy
**Steps:**
1. Select a familiar location
2. Compare route with Google Maps app

**Expected Result:**
- Route path matches Google Maps
- Same roads/highways used
- Similar distance and time estimate

---

### 5. Test Error Handling

#### Test Case 10: No Internet Connection
**Steps:**
1. Turn off WiFi and mobile data
2. Try searching for a location

**Expected Result:**
- Shows fallback to mock data
- Displays:
  - "Abuja City Centre"
  - "Lagos Island"
  - "Port Harcourt City"
  - etc.
- No crash

---

#### Test Case 11: Invalid Search
**Steps:**
1. Type random gibberish: "xyzabc123"
2. Wait for results

**Expected Result:**
- Shows "No places found"
- "Try a different search"
- No crash

---

#### Test Case 12: API Key Issues
**Steps:**
1. Temporarily remove API key from .env
2. Try searching

**Expected Result:**
- Falls back to mock data
- Console shows warning
- App continues working

---

### 6. Test Performance

#### Test Case 13: Debouncing
**Steps:**
1. Type quickly: "L" "a" "g" "o" "s"
2. Count API calls in console

**Expected Result:**
- Only makes 1 API call after typing stops
- Waits 300ms after last keystroke
- Not 5 separate calls for each letter

---

#### Test Case 14: Response Time
**Steps:**
1. Search for "Lagos"
2. Measure time to results

**Expected Result:**
- Autocomplete: < 1 second
- Place details: < 1 second
- Directions: < 2 seconds
- Total: < 3 seconds

---

### 7. Test UI/UX

#### Test Case 15: Loading States
**Steps:**
1. Search for a location
2. Observe loading indicators

**Expected Result:**
- Shows spinner while searching
- "Searching for places..." text
- Disables input during loading
- Results appear smoothly

---

#### Test Case 16: Empty States
**Steps:**
1. Open search without typing
2. Observe initial state

**Expected Result:**
- Shows "Recent" locations if available
- Or empty state with search hint
- Clean, not cluttered

---

#### Test Case 17: Clear Search
**Steps:**
1. Type a search query
2. Tap X button

**Expected Result:**
- Clears search input
- Removes suggestions
- Returns to initial state
- Ready for new search

---

### 8. Test on Different Locations

#### Test Case 18: Lagos
**Test Locations:**
- "Victoria Island" → Should show VI locations
- "Lekki" → Should show Lekki Phase 1, etc.
- "Ikeja" → Should show Ikeja GRA, etc.

---

#### Test Case 19: Abuja
**Test Locations:**
- "Maitama" → Should show Maitama District
- "Wuse" → Should show Wuse 2, Wuse Market
- "Jabi" → Should show Jabi Lake Mall

---

#### Test Case 20: Other Cities
**Test Locations:**
- "Port Harcourt" → Should show PH locations
- "Kano" → Should show Kano City locations
- "Ibadan" → Should show Ibadan locations

---

## 📊 Test Results Template

Use this to track your testing:

```markdown
### Test Run: [Date]

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC1: Search "Kuwa" | ✅ PASS | Shows suggestions |
| TC2: Search "Lagos" | ✅ PASS | Multiple results |
| TC3: Search "Abuja" | ✅ PASS | Abuja locations |
| TC4: Select Location | ✅ PASS | Route calculated |
| TC5: Distance Display | ✅ PASS | Shows correctly |
| TC6: Price Display | ✅ PASS | Matches formula |
| TC7: Different Distances | ✅ PASS | Scales correctly |
| TC8: Route Visualization | ✅ PASS | Map shows path |
| TC9: Route Accuracy | ✅ PASS | Matches Google |
| TC10: No Internet | ✅ PASS | Falls back |
| TC11: Invalid Search | ✅ PASS | Empty state |
| TC12: API Issues | ✅ PASS | Handles error |
| TC13: Debouncing | ✅ PASS | Single API call |
| TC14: Performance | ✅ PASS | < 3s total |
| TC15: Loading States | ✅ PASS | Smooth UX |
| TC16: Empty States | ✅ PASS | Clean UI |
| TC17: Clear Search | ✅ PASS | Resets properly |
| TC18: Lagos Locations | ✅ PASS | All work |
| TC19: Abuja Locations | ✅ PASS | All work |
| TC20: Other Cities | ✅ PASS | All work |

**Overall: PASS** ✅
```

---

## 🔍 Console Logs to Check

When testing, look for these console logs:

### Good Logs:
```
✅ "Using autocomplete for: Lagos"
✅ "Autocomplete suggestions: 5"
✅ "Selected autocomplete: ChIJ..."
✅ "Fetching place details for: ChIJ..."
✅ "Fetching directions from { lat, lng } to { lat, lng }"
✅ "Route found: { distance: 5000, duration: 900, points: 25 }"
```

### Warning Logs (Acceptable):
```
⚠️ "Google Maps API key is missing, using mock data"
⚠️ "No autocomplete results, falling back to search"
```

### Error Logs (Need Fixing):
```
❌ "API Error: OVER_QUERY_LIMIT"
❌ "Directions API error: NOT_FOUND"
❌ "Error searching locations: [error details]"
```

---

## 🎯 Quick Smoke Test (2 Minutes)

To quickly verify everything works:

1. **Search**: Type "Lagos" → See suggestions ✅
2. **Select**: Tap "Lagos Island" → See loading ✅
3. **Route**: Check map shows blue line ✅
4. **Price**: Verify "From ₦X,XXX" displayed ✅
5. **Navigate**: Can proceed to confirmation ✅

If all 5 pass → **System Working** ✅

---

## 📱 Device Testing

### Test on Both:
- [ ] iOS (physical device or simulator)
- [ ] Android (physical device or emulator)
- [ ] Web (browser)

### Verify:
- [ ] GPS location works
- [ ] Search is fast
- [ ] Map renders correctly
- [ ] Prices display properly
- [ ] Navigation flows smoothly

---

## 🐛 Known Issues to Watch For

1. **API Quota**: Daily limit is 2500 requests
   - Monitor usage in Google Cloud Console
   
2. **Location Permission**: Required for accurate results
   - Test with permission denied scenario
   
3. **Network Errors**: Poor connection may slow down
   - Test on 3G/slow network
   
4. **Large Distances**: Very far destinations may timeout
   - Test with 100km+ locations

---

## ✅ Success Criteria

Your implementation passes if:

1. ✅ Autocomplete shows suggestions within 1 second
2. ✅ Route calculation works for any location
3. ✅ Prices match the formula: ₦500 + (km × ₦150) × multiplier
4. ✅ Map shows route path correctly
5. ✅ No crashes or errors
6. ✅ Works on both iOS and Android
7. ✅ Graceful fallback when offline

---

## 🎉 Ready to Test!

Your implementation is complete. Follow this guide to verify everything works as expected. Good luck! 🚀
