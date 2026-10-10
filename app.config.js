const appJson = require("./app.json");

// The google-signin config plugin validates iosUrlScheme at prebuild time and
// rejects anything that doesn't look like a real reversed client ID, so app.json
// carries a placeholder that satisfies that check before Google Cloud credentials
// exist. Once EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME is set in .env, swap it in here —
// same pattern as the Maps API key injection below.
//
// Google's own official public sample AdMob App IDs — the Android manifest
// merger requires a real (non-empty) value for this placeholder, unlike ad unit
// IDs, which hooks/useRewardedAd.ts can safely resolve to TestIds at JS runtime
// when unset. Falling back to these here means a build never fails just because
// EXPO_PUBLIC_ADMOB_*_APP_ID hasn't been configured yet.
const ADMOB_TEST_APP_ID_ANDROID = "ca-app-pub-3940256099942544~3347511713";
const ADMOB_TEST_APP_ID_IOS = "ca-app-pub-3940256099942544~1458002511";

const resolvedPlugins = appJson.expo.plugins.map((plugin) => {
  if (Array.isArray(plugin) && plugin[0] === "@react-native-google-signin/google-signin" && process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME) {
    return [plugin[0], { ...plugin[1], iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME }];
  }
  if (Array.isArray(plugin) && plugin[0] === "react-native-google-mobile-ads") {
    return [
      plugin[0],
      {
        ...plugin[1],
        androidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || ADMOB_TEST_APP_ID_ANDROID,
        iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || ADMOB_TEST_APP_ID_IOS,
      },
    ];
  }
  return plugin;
});

// iOS App Tracking Transparency prompt (lib/ad-consent.ts), shown only to riders
// who turned Personalized Ads on. Added here rather than in app.json to keep the
// plugin list there untouched; the plugin writes NSUserTrackingUsageDescription
// to Info.plist (and the AD_ID permission on Android). Needs a new native build.
const TRACKING_USAGE_DESCRIPTION =
  "Allow tracking so Pantra can show you ads that match your interests. You'll still see ads if you decline, and you can change this in Settings at any time.";
if (!resolvedPlugins.some((p) => (Array.isArray(p) ? p[0] : p) === "expo-tracking-transparency")) {
  resolvedPlugins.push(["expo-tracking-transparency", { userTrackingPermission: TRACKING_USAGE_DESCRIPTION }]);
}

// Crash reporting (lib/monitoring.ts). Source maps are uploaded at build time only when SENTRY_AUTH_TOKEN,
// SENTRY_ORG and SENTRY_PROJECT are set on the build; without them the app still reports, just with
// unreadable (minified) stack traces. Needs a new native build.
resolvedPlugins.push([
  "@sentry/react-native/expo",
  { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT },
]);

module.exports = ({ config }) => ({
  ...config,
  ...appJson.expo,
  plugins: resolvedPlugins,
  ios: {
    ...appJson.expo.ios,
    config: {
      ...appJson.expo.ios.config,
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    },
  },
  android: {
    ...appJson.expo.android,
    config: {
      ...appJson.expo.android.config,
      googleMaps: {
        ...appJson.expo.android.config.googleMaps,
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
  },
  extra: {
    ...(config.extra || {}),
    ...(appJson.expo.extra || {}),
    rorkApiBaseUrl: process.env.EXPO_PUBLIC_RORK_API_BASE_URL,
  },
});
