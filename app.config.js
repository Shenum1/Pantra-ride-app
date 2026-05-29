const appJson = require("./app.json");

module.exports = ({ config }) => ({
  ...config,
  ...appJson.expo,
  extra: {
    ...(config.extra || {}),
    ...(appJson.expo.extra || {}),
    rorkApiBaseUrl: process.env.EXPO_PUBLIC_RORK_API_BASE_URL,
  },
});
