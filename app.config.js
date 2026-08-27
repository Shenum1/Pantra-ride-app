const appJson = require("./app.json");

// The google-signin config plugin validates iosUrlScheme at prebuild time and
// rejects anything that doesn't look like a real reversed client ID, so app.json
// carries a placeholder that satisfies that check before Google Cloud credentials
// exist. Once EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME is set in .env, swap it in here —
// same pattern as the Maps API key injection below.
const googleSigninPlugins = appJson.expo.plugins.map((plugin) => {
  if (Array.isArray(plugin) && plugin[0] === "@react-native-google-signin/google-signin" && process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME) {
    return [plugin[0], { ...plugin[1], iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME }];
  }
  return plugin;
});

module.exports = ({ config }) => ({
  ...config,
  ...appJson.expo,
  plugins: googleSigninPlugins,
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
