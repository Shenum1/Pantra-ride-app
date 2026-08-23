// The app only operates in Nigeria. This is a map-camera/search-bias default only —
// used to pick an initial zoomed-out view before any real location is known, or to
// bias place-search results, never presented as a user's/driver's actual location
// (map components only show a "you are here" marker for a real userLocation).
export const NIGERIA_DEFAULT_COORDS = {
  latitude: 9.0765,
  longitude: 7.3986,
};

export const NIGERIA_DEFAULT_REGION = {
  ...NIGERIA_DEFAULT_COORDS,
  latitudeDelta: 0.035,
  longitudeDelta: 0.035,
};
