# Map API Setup Guide

This guide will help you set up the necessary Map APIs for your ride-sharing application.

## Google Maps API Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter a project name (e.g., "RideShare App")
4. Click "Create"

### 2. Enable Required APIs

Enable the following APIs in your Google Cloud project:

1. **Maps SDK for Android**
   - Go to "APIs & Services" → "Library"
   - Search for "Maps SDK for Android"
   - Click "Enable"

2. **Maps SDK for iOS**
   - Search for "Maps SDK for iOS"
   - Click "Enable"

3. **Maps JavaScript API** (for web support)
   - Search for "Maps JavaScript API"
   - Click "Enable"

4. **Places API** (for place search and autocomplete)
   - Search for "Places API"
   - Click "Enable"

5. **Directions API** (for route calculation)
   - Search for "Directions API"
   - Click "Enable"

6. **Distance Matrix API** (for calculating distances)
   - Search for "Distance Matrix API"
   - Click "Enable"

7. **Geocoding API** (for address to coordinates conversion)
   - Search for "Geocoding API"
   - Click "Enable"

### 3. Create API Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the API key
4. Click "Restrict Key" (recommended for security)

### 4. Restrict Your API Key (Recommended)

#### For Production:
1. **Application restrictions:**
   - Android apps: Add your app's package name and SHA-1 certificate fingerprint
   - iOS apps: Add your app's bundle identifier
   - Websites: Add your website URLs

2. **API restrictions:**
   - Select "Restrict key"
   - Choose the APIs you enabled above

#### For Development:
- You can leave it unrestricted initially, but **always restrict before production**

### 5. Add API Key to Your Project

1. Create a `.env` file in your project root (if it doesn't exist)
2. Copy the contents from `.env.example`
3. Add your Google Maps API key:

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
```

### 6. Configure for React Native

For a production React Native app with real maps (not the current simulated version), you would need to:

1. **Install react-native-maps:**
   ```bash
   npx expo install react-native-maps
   ```

2. **Configure for iOS (app.json):**
   ```json
   {
     "expo": {
       "ios": {
         "config": {
           "googleMapsApiKey": "YOUR_IOS_API_KEY"
         }
       }
     }
   }
   ```

3. **Configure for Android (app.json):**
   ```json
   {
     "expo": {
       "android": {
         "config": {
           "googleMaps": {
             "apiKey": "YOUR_ANDROID_API_KEY"
           }
         }
       }
     }
   }
   ```

## Alternative: Mapbox

If you prefer Mapbox over Google Maps:

### 1. Create a Mapbox Account
1. Go to [Mapbox](https://www.mapbox.com/)
2. Sign up for a free account
3. Go to your [Account Dashboard](https://account.mapbox.com/)

### 2. Get Your Access Token
1. Copy your default public token
2. Or create a new token with specific scopes

### 3. Add to Your Project
```env
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your-mapbox-token-here
```

### 4. Install Mapbox SDK
```bash
npx expo install @rnmapbox/maps
```

## Current Implementation

**Note:** Your current app uses a **simulated map** (styled View components) that works on both web and mobile without requiring API keys. This is perfect for:
- Development and testing
- Demos and prototypes
- Apps that don't need real map interaction

To use real maps, you'll need to:
1. Get the API keys as described above
2. Replace the `Map.tsx` component with a real map implementation
3. Handle platform-specific configurations

## Cost Considerations

### Google Maps Pricing:
- **Free tier:** $200 credit per month
- **Maps SDK:** $7 per 1,000 loads
- **Directions API:** $5 per 1,000 requests
- **Places API:** $17 per 1,000 requests

### Mapbox Pricing:
- **Free tier:** 50,000 map loads per month
- More affordable for high-volume apps

## Security Best Practices

1. **Never commit API keys to Git**
   - Use `.env` files (already in `.gitignore`)
   - Use environment variables

2. **Restrict API keys**
   - Add application restrictions
   - Add API restrictions
   - Monitor usage in Google Cloud Console

3. **Use different keys for development and production**

4. **Rotate keys regularly**

5. **Monitor usage and set up billing alerts**

## Testing Your Setup

Once you have your API key:

1. Add it to `.env`:
   ```env
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
   ```

2. Restart your development server:
   ```bash
   npx expo start --clear
   ```

3. The app will now have access to the API key via:
   ```typescript
   process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
   ```

## Need Help?

- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [Mapbox Documentation](https://docs.mapbox.com/)
- [React Native Maps Documentation](https://github.com/react-native-maps/react-native-maps)
- [Expo Location Documentation](https://docs.expo.dev/versions/latest/sdk/location/)
