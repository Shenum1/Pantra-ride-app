import { Compass, MapPin, Navigation } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Camera, Details, EdgePadding, LatLng, Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as ExpoLocation from 'expo-location';

import Colors from '@/constants/colors';
import { MAP_COLORS, PANTRA_MAP_STYLE } from '@/constants/map-style';
import { NIGERIA_DEFAULT_REGION } from '@/constants/nigeria-region';
import { PointMarker, VehicleMarker } from '@/components/MapMarkers';
import { Skeleton } from '@/components/skeletons';
import { useLocation } from '@/hooks/useLocationStore';
import { useRide } from '@/hooks/useRideStore';
import { GoogleMapsService } from '@/lib/google-maps-service';
import { distanceMeters, isInsidePaddedBounds, shouldRefetchMovingRoute, trimPolylineFrom } from '@/lib/map-geometry';
import { Location } from '@/types';

interface CustomMarker {
  id: string;
  location: Location;
  title?: string;
  description?: string;
  type?: 'driver' | 'pickup' | 'dropoff';
}

// Live-trip camera: keep the moving vehicle and where it is heading in view.
export interface MapTracking {
  vehicle: Location | null;
  target: Location | null;
}

interface MapProps {
  showDrivers?: boolean;
  showRoute?: boolean;
  onRegionChange?: (region: Location) => void;
  initialRegion?: Location;
  style?: any;
  fullScreen?: boolean;
  onRouteInfoChange?: (info: { distance: number; duration: number } | null) => void;
  routeStartLocation?: Location | null;
  routeEndLocation?: Location | null;
  customMarkers?: CustomMarker[];
  preferStaticMap?: boolean;
  // false on driver screens: drivers must see the location disclosure
  // (hooks/useDriverLocationConsent.tsx) before any system prompt, so the map only checks.
  askForLocation?: boolean;
  // Space covered by the screen's own overlays (headers, cards, bottom
  // sheets). The map centres content and places Google's logo inside the
  // remaining area, and its floating buttons sit just below `top`.
  mapPadding?: Partial<EdgePadding>;
  // When set, the camera follows the vehicle instead of `initialRegion`, and
  // a route starting at the vehicle is refreshed sparingly instead of on
  // every position update.
  tracking?: MapTracking;
}

const EMPTY_MARKERS: CustomMarker[] = [];

const DEFAULT_DELTA = {
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

// Used only by screens that don't pass mapPadding.
const LEGACY_FIT_PADDING = {
  fullScreen: { top: 160, right: 48, bottom: 320, left: 48 },
  inline: { top: 100, right: 48, bottom: 100, left: 48 },
};
const DEFAULT_CONTROLS_TOP = 86;
const CONTROLS_GAP = 12;
const CONTROL_SPACING = 56;
// Extra room around fitted content, on top of the overlay padding.
// react-native-maps' fitToCoordinates edgePadding replaces mapPadding for the
// fit, so both are added together.
const FIT_MARGIN = 40;
const RECENTER_ZOOM = 16;
// Closer than this, fitting two points would zoom to the maximum.
const CLOSE_POINTS_METERS = 30;
const MIN_HEADING_CHANGE_DEGREES = 3;

function toLatLng(location: Location): LatLng {
  return { latitude: location.latitude, longitude: location.longitude };
}

function coordinateKey(location: Location) {
  return `${location.latitude.toFixed(5)}:${location.longitude.toFixed(5)}`;
}

function isSameCoordinate(a: Location | null | undefined, b: Location | null | undefined) {
  return Boolean(a && b && a.latitude === b.latitude && a.longitude === b.longitude);
}

function buildRouteKey(pickup: Location | null, dropoff: Location | null) {
  if (!pickup || !dropoff) {
    return null;
  }

  return [
    pickup.latitude.toFixed(5),
    pickup.longitude.toFixed(5),
    dropoff.latitude.toFixed(5),
    dropoff.longitude.toFixed(5),
  ].join(':');
}

function hasMeaningfulRegionChange(current: Location | undefined, next: Region) {
  if (!current) {
    return true;
  }

  return (
    Math.abs(current.latitude - next.latitude) > 0.0003 ||
    Math.abs(current.longitude - next.longitude) > 0.0003 ||
    Math.abs((current.latitudeDelta ?? DEFAULT_DELTA.latitudeDelta) - next.latitudeDelta) > 0.001 ||
    Math.abs((current.longitudeDelta ?? DEFAULT_DELTA.longitudeDelta) - next.longitudeDelta) > 0.001
  );
}

function headingDifference(a: number, b: number) {
  return Math.abs(((b - a + 540) % 360) - 180);
}

function buildStaticMapUrl(params: {
  center: Location;
  routePolyline: string;
  markers: CustomMarker[];
  width: number;
  height: number;
}) {
  return GoogleMapsService.buildStaticMapUrl({
    center: params.center,
    routePolyline: params.routePolyline,
    markers: params.markers,
    width: params.width,
    height: params.height,
  });
}

const Map: React.FC<MapProps> = ({
  showDrivers = true,
  showRoute = false,
  initialRegion,
  style,
  onRegionChange,
  fullScreen = false,
  onRouteInfoChange,
  routeStartLocation,
  routeEndLocation,
  customMarkers,
  preferStaticMap = false,
  askForLocation = true,
  mapPadding,
  tracking,
}) => {
  const { userLocation, pickupLocation, dropoffLocation, routeInfo: sharedRouteInfo } = useLocation();
  const { nearbyDrivers } = useRide();
  const [currentRegion, setCurrentRegion] = useState<Location | undefined>(undefined);
  const [routeCoordinates, setRouteCoordinates] = useState<LatLng[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [routePolyline, setRoutePolyline] = useState<string>('');
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false);
  const [heading, setHeading] = useState<number>(0);
  const [followUserLocation, setFollowUserLocation] = useState<boolean>(true);
  const [compassEnabled, setCompassEnabled] = useState<boolean>(false);
  const [userInteracted, setUserInteracted] = useState<boolean>(false);
  const [mapRenderAttempt, setMapRenderAttempt] = useState<number>(0);
  const [hasMapLoaded, setHasMapLoaded] = useState<boolean>(Platform.OS === 'web');
  const [useCleanFallback, setUseCleanFallback] = useState<boolean>(false);
  const [staticMapFailed, setStaticMapFailed] = useState<boolean>(false);
  const mapRef = useRef<MapView | null>(null);
  const headingSubscription = useRef<ExpoLocation.LocationSubscription | null>(null);
  const lastHeadingRef = useRef<number>(0);
  const routeRequestKeyRef = useRef<string | null>(null);
  const routeCoordinatesRef = useRef<LatLng[]>([]);
  const routeFetchInFlightRef = useRef<boolean>(false);
  const lastRouteFetchAtRef = useRef<number>(0);
  const fittedRouteKeyRef = useRef<string | null>(null);
  const trackingFitKeyRef = useRef<string | null>(null);
  const lastAnimatedRegionKeyRef = useRef<string | null>(null);
  const mapLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read inside async route callbacks, which must not re-run when it changes.
  const userInteractedRef = useRef<boolean>(false);
  userInteractedRef.current = userInteracted;

  const activeRouteStart = routeStartLocation ?? pickupLocation;
  const activeRouteEnd = routeEndLocation ?? dropoffLocation;
  const activeMarkers = customMarkers ?? EMPTY_MARKERS;
  const trackingVehicle = tracking?.vehicle ?? null;
  const trackingTarget = tracking?.target ?? null;
  const isTracking = tracking !== undefined;
  // A route that starts at the moving vehicle is keyed on its destination
  // only; keying on the start would refetch Directions on every GPS update.
  const isMovingRoute = Boolean(showRoute && trackingVehicle && isSameCoordinate(activeRouteStart, trackingVehicle));

  const routeKey = useMemo(() => {
    if (!showRoute || !activeRouteStart || !activeRouteEnd) {
      return null;
    }
    return isMovingRoute ? `moving:${coordinateKey(activeRouteEnd)}` : buildRouteKey(activeRouteStart, activeRouteEnd);
  }, [activeRouteEnd, activeRouteStart, isMovingRoute, showRoute]);

  const fitEdgePadding = useMemo<EdgePadding>(() => {
    if (!mapPadding) {
      return fullScreen ? LEGACY_FIT_PADDING.fullScreen : LEGACY_FIT_PADDING.inline;
    }
    return {
      top: (mapPadding.top ?? 0) + FIT_MARGIN,
      right: (mapPadding.right ?? 0) + FIT_MARGIN,
      bottom: (mapPadding.bottom ?? 0) + FIT_MARGIN,
      left: (mapPadding.left ?? 0) + FIT_MARGIN,
    };
  }, [fullScreen, mapPadding]);

  const nativeMapPadding = useMemo<EdgePadding | undefined>(() => (
    mapPadding
      ? { top: mapPadding.top ?? 0, right: mapPadding.right ?? 0, bottom: mapPadding.bottom ?? 0, left: mapPadding.left ?? 0 }
      : undefined
  ), [mapPadding]);

  const controlsTop = mapPadding ? (mapPadding.top ?? 0) + CONTROLS_GAP : DEFAULT_CONTROLS_TOP;

  const staticMapMarkers = useMemo<CustomMarker[]>(() => {
    const markers: CustomMarker[] = [];

    if (!customMarkers && pickupLocation) {
      markers.push({
        id: 'static-pickup',
        location: pickupLocation,
        title: 'Pickup Location',
        type: 'pickup',
      });
    }

    if (!customMarkers && dropoffLocation) {
      markers.push({
        id: 'static-dropoff',
        location: dropoffLocation,
        title: 'Dropoff Location',
        type: 'dropoff',
      });
    }

    if (showDrivers) {
      nearbyDrivers.forEach((driver) => {
        if (!driver.location) return;
        markers.push({
          id: `static-driver-${driver.id}`,
          location: driver.location,
          title: driver.name,
          description: `${driver.carModel} - ${driver.rating}`,
          type: 'driver',
        });
      });
    }

    return [...markers, ...activeMarkers];
  }, [activeMarkers, customMarkers, dropoffLocation, nearbyDrivers, pickupLocation, showDrivers]);

  const resolvedInitialRegion = useMemo<Location | undefined>(() => {
    const source = initialRegion ?? activeRouteStart ?? userLocation ?? NIGERIA_DEFAULT_REGION;

    if (!source) {
      return undefined;
    }

    return {
      latitude: source.latitude,
      longitude: source.longitude,
      latitudeDelta: source.latitudeDelta ?? DEFAULT_DELTA.latitudeDelta,
      longitudeDelta: source.longitudeDelta ?? DEFAULT_DELTA.longitudeDelta,
    };
  }, [activeRouteStart, initialRegion, userLocation]);

  const staticMapUrl = useMemo(() => {
    if (!resolvedInitialRegion) {
      return null;
    }

    return buildStaticMapUrl({
      center: resolvedInitialRegion,
      routePolyline,
      markers: staticMapMarkers,
      width: fullScreen ? 1200 : 900,
      height: fullScreen ? 1800 : 700,
    });
  }, [fullScreen, resolvedInitialRegion, routePolyline, staticMapMarkers]);

  const shouldRenderCleanFallback = !staticMapUrl || staticMapFailed || (Platform.OS !== 'web' && !preferStaticMap && useCleanFallback);
  const shouldRenderStaticMap = !!staticMapUrl && !staticMapFailed;

  useEffect(() => {
    if (resolvedInitialRegion && !currentRegion) {
      setCurrentRegion(resolvedInitialRegion);
    }
  }, [currentRegion, resolvedInitialRegion]);

  useEffect(() => {
    if (Platform.OS === 'web' || preferStaticMap) {
      setHasMapLoaded(true);
      setUseCleanFallback(false);
      return;
    }

    setHasMapLoaded(false);
    setUseCleanFallback(false);

    if (mapLoadTimeoutRef.current) {
      clearTimeout(mapLoadTimeoutRef.current);
    }

    mapLoadTimeoutRef.current = setTimeout(() => {
      console.log('Map load timeout reached on attempt:', mapRenderAttempt);
      if (mapRenderAttempt < 1) {
        console.log('Retrying native map render...');
        setMapRenderAttempt((prev: number) => prev + 1);
        return;
      }
      console.log('Native map failed after retry, switching to clean fallback');
      setUseCleanFallback(true);
    }, 4500);

    return () => {
      if (mapLoadTimeoutRef.current) {
        clearTimeout(mapLoadTimeoutRef.current);
        mapLoadTimeoutRef.current = null;
      }
    };
  }, [mapRenderAttempt, preferStaticMap]);

  // Screens without live tracking: move to `initialRegion` when it changes
  // (e.g. the rider's location arrives), unless the rider has moved the map.
  useEffect(() => {
    if (isTracking || !mapRef.current || !resolvedInitialRegion || userInteracted) {
      return;
    }

    const regionKey = [
      resolvedInitialRegion.latitude.toFixed(5),
      resolvedInitialRegion.longitude.toFixed(5),
      (resolvedInitialRegion.latitudeDelta ?? DEFAULT_DELTA.latitudeDelta).toFixed(4),
      (resolvedInitialRegion.longitudeDelta ?? DEFAULT_DELTA.longitudeDelta).toFixed(4),
    ].join(':');

    if (lastAnimatedRegionKeyRef.current === regionKey) {
      return;
    }

    const normalizedRegion: Region = {
      latitude: resolvedInitialRegion.latitude,
      longitude: resolvedInitialRegion.longitude,
      latitudeDelta: resolvedInitialRegion.latitudeDelta ?? DEFAULT_DELTA.latitudeDelta,
      longitudeDelta: resolvedInitialRegion.longitudeDelta ?? DEFAULT_DELTA.longitudeDelta,
    };

    lastAnimatedRegionKeyRef.current = regionKey;
    mapRef.current.animateToRegion(normalizedRegion, 250);
    setCurrentRegion(normalizedRegion);
  }, [isTracking, resolvedInitialRegion, userInteracted]);

  useEffect(() => {
    if (Platform.OS === 'web' || !fullScreen) {
      return;
    }

    const startHeadingTracking = async () => {
      try {
        const { status } = askForLocation
          ? await ExpoLocation.requestForegroundPermissionsAsync()
          : await ExpoLocation.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Location permission not granted for heading tracking');
          return;
        }

        const servicesEnabled = await ExpoLocation.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          console.log('Location services not enabled for heading tracking');
          return;
        }

        headingSubscription.current = await ExpoLocation.watchHeadingAsync((headingData: ExpoLocation.LocationHeadingObject) => {
          if (!compassEnabled) {
            return;
          }

          const nextHeading = headingData.trueHeading !== -1 ? headingData.trueHeading : headingData.magHeading;
          if (nextHeading === -1) {
            return;
          }

          // The sensor reports many times a second; small changes would
          // re-animate the camera continuously for no visible gain.
          if (headingDifference(lastHeadingRef.current, nextHeading) < MIN_HEADING_CHANGE_DEGREES) {
            return;
          }

          lastHeadingRef.current = nextHeading;
          setHeading(nextHeading);
        });
      } catch (error) {
        console.error('Error starting heading tracking:', error);
      }
    };

    if (compassEnabled) {
      void startHeadingTracking();
    }

    return () => {
      if (headingSubscription.current) {
        headingSubscription.current.remove();
        headingSubscription.current = null;
      }
    };
  }, [askForLocation, compassEnabled, fullScreen]);

  const notifyRouteInfoChange = useCallback((info: { distance: number; duration: number } | null) => {
    setRouteInfo(info);
    onRouteInfoChange?.(info);
  }, [onRouteInfoChange]);

  const applyRouteCoordinates = useCallback((coordinates: LatLng[]) => {
    routeCoordinatesRef.current = coordinates;
    setRouteCoordinates(coordinates);
  }, []);

  const clearRoute = useCallback(() => {
    routeRequestKeyRef.current = null;
    fittedRouteKeyRef.current = null;
    applyRouteCoordinates([]);
    setRoutePolyline('');
    notifyRouteInfoChange(null);
  }, [applyRouteCoordinates, notifyRouteInfoChange]);

  const fitRoute = useCallback((key: string, coordinates: LatLng[]) => {
    if (userInteractedRef.current || !mapRef.current || fittedRouteKeyRef.current === key || coordinates.length === 0) {
      return;
    }

    fittedRouteKeyRef.current = key;
    requestAnimationFrame(() => {
      mapRef.current?.fitToCoordinates(coordinates, { edgePadding: fitEdgePadding, animated: true });
    });
  }, [fitEdgePadding]);

  const requestRoute = useCallback(async (key: string, start: Location, end: Location, moving: boolean) => {
    routeRequestKeyRef.current = key;
    routeFetchInFlightRef.current = true;
    lastRouteFetchAtRef.current = Date.now();
    const hasDrawnRoute = routeCoordinatesRef.current.length > 0;
    if (!hasDrawnRoute) {
      setIsLoadingRoute(true);
    }
    console.log('Fetching map route for key:', key);

    try {
      let directions = await GoogleMapsService.getDirections(start, end);

      if (!directions) {
        console.log('Retrying map route fetch once after failure...');
        directions = await GoogleMapsService.getDirections(start, end);
      }

      // Superseded by a newer destination while this request was in flight.
      if (routeRequestKeyRef.current !== key) {
        return;
      }

      // Mid-trip, a failed or straight-line estimate must not replace the
      // real road route already on screen; it is retried on the next refresh.
      if (moving && hasDrawnRoute && (!directions || directions.isEstimate)) {
        console.log('Keeping current route; refresh failed for key:', key);
        return;
      }

      if (!directions) {
        console.error('Route fetch still failed after retry');
        clearRoute();
        return;
      }

      applyRouteCoordinates(directions.coordinates);
      setRoutePolyline(directions.polyline ?? '');
      notifyRouteInfoChange({
        distance: directions.distance,
        duration: directions.duration,
      });

      // Moving routes are framed by the tracking camera instead.
      if (!moving) {
        fitRoute(key, directions.coordinates);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      if (!(moving && hasDrawnRoute)) {
        clearRoute();
      }
    } finally {
      routeFetchInFlightRef.current = false;
      setIsLoadingRoute(false);
    }
  }, [applyRouteCoordinates, clearRoute, fitRoute, notifyRouteInfoChange]);

  useEffect(() => {
    if (!routeKey || !activeRouteStart || !activeRouteEnd) {
      if (routeRequestKeyRef.current !== null || routeCoordinatesRef.current.length > 0) {
        clearRoute();
      }
      return;
    }

    if (isMovingRoute) {
      if (routeRequestKeyRef.current === routeKey) {
        if (routeFetchInFlightRef.current) {
          return;
        }

        const needsRefetch = shouldRefetchMovingRoute({
          vehicle: activeRouteStart,
          polyline: routeCoordinatesRef.current,
          lastFetchAt: lastRouteFetchAtRef.current,
          now: Date.now(),
        });

        if (!needsRefetch) {
          // Still on the drawn route: drop the part already driven.
          if (routeCoordinatesRef.current.length >= 2) {
            applyRouteCoordinates(trimPolylineFrom(activeRouteStart, routeCoordinatesRef.current));
          }
          return;
        }
      }

      void requestRoute(routeKey, activeRouteStart, activeRouteEnd, true);
      return;
    }

    const isSharedPickupDropoffRoute = buildRouteKey(pickupLocation, dropoffLocation) === routeKey;

    if (isSharedPickupDropoffRoute && sharedRouteInfo?.coordinates?.length) {
      if (routeRequestKeyRef.current === routeKey && routeCoordinatesRef.current === sharedRouteInfo.coordinates) {
        return;
      }
      console.log('Using shared route info from location store for key:', routeKey);
      routeRequestKeyRef.current = routeKey;
      applyRouteCoordinates(sharedRouteInfo.coordinates);
      setRoutePolyline(sharedRouteInfo.polyline ?? '');
      notifyRouteInfoChange({
        distance: sharedRouteInfo.distance,
        duration: sharedRouteInfo.duration,
      });
      fitRoute(routeKey, sharedRouteInfo.coordinates);
      return;
    }

    if (routeRequestKeyRef.current === routeKey) {
      return;
    }

    void requestRoute(routeKey, activeRouteStart, activeRouteEnd, false);
  }, [activeRouteEnd, activeRouteStart, applyRouteCoordinates, clearRoute, dropoffLocation, fitRoute, isMovingRoute, notifyRouteInfoChange, pickupLocation, requestRoute, routeKey, sharedRouteInfo]);

  const fitCameraTo = useCallback((points: Location[]) => {
    const map = mapRef.current;
    if (!map || points.length === 0) {
      return;
    }

    const [first] = points;
    const spread = Math.max(0, ...points.slice(1).map((point) => distanceMeters(first, point)));

    if (spread < CLOSE_POINTS_METERS) {
      map.animateCamera({ center: toLatLng(first), zoom: RECENTER_ZOOM, heading: 0, pitch: 0 }, { duration: 500 });
      return;
    }

    map.fitToCoordinates(points.map(toLatLng), { edgePadding: fitEdgePadding, animated: true });
  }, [fitEdgePadding]);

  const trackingPoints = useMemo(
    () => [trackingVehicle, trackingTarget].filter((point): point is Location => point !== null),
    [trackingTarget, trackingVehicle]
  );

  // Live-trip camera. Frames vehicle + target when the map is ready and when
  // the target changes (pickup -> destination). Otherwise it stays still and
  // only re-frames when the vehicle nears the edge of the screen. Any user
  // gesture hands control to the user until they press recenter.
  useEffect(() => {
    if (!isTracking || !hasMapLoaded || userInteracted || compassEnabled || trackingPoints.length === 0) {
      return;
    }

    const frameKey = `${trackingTarget ? coordinateKey(trackingTarget) : 'none'}|${trackingVehicle ? 'vehicle' : 'no-vehicle'}`;
    if (trackingFitKeyRef.current !== frameKey) {
      trackingFitKeyRef.current = frameKey;
      fitCameraTo(trackingPoints);
      return;
    }

    if (!trackingVehicle || !mapRef.current) {
      return;
    }

    let cancelled = false;
    mapRef.current.getMapBoundaries()
      .then((bounds) => {
        if (!cancelled && !isInsidePaddedBounds(trackingVehicle, bounds)) {
          fitCameraTo(trackingPoints);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [compassEnabled, fitCameraTo, hasMapLoaded, isTracking, trackingPoints, trackingTarget, trackingVehicle, userInteracted]);

  const markUserInteracted = useCallback(() => {
    userInteractedRef.current = true;
    setUserInteracted(true);
    setFollowUserLocation(false);
  }, []);

  const handleRegionChangeComplete = useCallback((nextRegion: Region, details?: Details) => {
    // Catches pinch-zoom and rotate as well as drags (onPanDrag).
    if (details?.isGesture) {
      markUserInteracted();
    }

    if (!hasMeaningfulRegionChange(currentRegion, nextRegion)) {
      return;
    }

    const normalizedRegion: Location = {
      latitude: nextRegion.latitude,
      longitude: nextRegion.longitude,
      latitudeDelta: nextRegion.latitudeDelta,
      longitudeDelta: nextRegion.longitudeDelta,
    };

    setCurrentRegion(normalizedRegion);
    onRegionChange?.(normalizedRegion);
  }, [currentRegion, markUserInteracted, onRegionChange]);

  const toggleCompass = useCallback(() => {
    setCompassEnabled((prev: boolean) => {
      if (prev) {
        setHeading(0);
        lastHeadingRef.current = 0;
      }
      return !prev;
    });
  }, []);

  const recenterMap = useCallback(() => {
    if (!mapRef.current) {
      return;
    }

    if (isTracking && !compassEnabled && trackingPoints.length > 0) {
      userInteractedRef.current = false;
      setUserInteracted(false);
      fitCameraTo(trackingPoints);
      return;
    }

    if (!userLocation) {
      return;
    }

    const camera: Camera = {
      center: {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      },
      pitch: compassEnabled ? 45 : 0,
      heading: compassEnabled ? heading : 0,
      altitude: 1000,
      zoom: RECENTER_ZOOM,
    };

    mapRef.current.animateCamera(camera, { duration: 300 });
    setCurrentRegion({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: DEFAULT_DELTA.latitudeDelta,
      longitudeDelta: DEFAULT_DELTA.longitudeDelta,
    });
    setFollowUserLocation(true);
    userInteractedRef.current = false;
    setUserInteracted(false);
  }, [compassEnabled, fitCameraTo, heading, isTracking, trackingPoints, userLocation]);

  useEffect(() => {
    if (!compassEnabled || !followUserLocation || !userLocation || !mapRef.current || Platform.OS === 'web') {
      return;
    }

    const camera: Camera = {
      center: {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      },
      pitch: 45,
      heading,
      altitude: 800,
      zoom: 17,
    };

    mapRef.current.animateCamera(camera, { duration: 100 });
  }, [compassEnabled, followUserLocation, heading, userLocation]);

  const renderMarker = (marker: CustomMarker) => {
    const coordinate = toLatLng(marker.location);

    if (marker.type === 'driver') {
      return (
        <VehicleMarker
          key={marker.id}
          coordinate={coordinate}
          title={marker.title}
          description={marker.description}
          testID={`map-marker-${marker.id}`}
        />
      );
    }

    if (marker.type === 'pickup' || marker.type === 'dropoff') {
      return (
        <PointMarker
          key={marker.id}
          kind={marker.type}
          coordinate={coordinate}
          title={marker.title}
          description={marker.description}
          testID={`map-marker-${marker.id}`}
        />
      );
    }

    return (
      <Marker
        key={marker.id}
        coordinate={coordinate}
        title={marker.title}
        description={marker.description}
      />
    );
  };

  return (
    <View style={[fullScreen ? styles.fullScreenContainer : styles.container, style]} testID="map-container">
      {!fullScreen && (
        <View style={styles.mapHeader}>
          <Text style={styles.mapTitle}>Ride Map</Text>
        </View>
      )}

      <View style={fullScreen ? styles.fullScreenMapContainer : styles.mapContainer}>
        {Platform.OS !== 'web' && !preferStaticMap ? (
          <MapView
            key={`google-map-${mapRenderAttempt}`}
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            // Code-defined JSON style (constants/map-style.ts). Don't add a
            // googleMapId alongside it: with a Map ID the SDK ignores this.
            customMapStyle={PANTRA_MAP_STYLE}
            mapType="standard"
            showsBuildings={false}
            showsIndoors={false}
            showsIndoorLevelPicker={false}
            showsTraffic={false}
            toolbarEnabled={false}
            moveOnMarkerPress={false}
            loadingBackgroundColor={MAP_COLORS.land}
            mapPadding={nativeMapPadding}
            initialRegion={resolvedInitialRegion as Region}
            showsUserLocation={Boolean(userLocation)}
            showsMyLocationButton={false}
            showsCompass={false}
            onMapReady={() => {
              setHasMapLoaded(true);
              setUseCleanFallback(false);
            }}
            onRegionChangeComplete={handleRegionChangeComplete}
            onPanDrag={markUserInteracted}
            testID="google-native-map"
          >
            {showRoute && routeCoordinates.length > 0 ? (
              <>
                <Polyline coordinates={routeCoordinates} strokeWidth={9} strokeColor={MAP_COLORS.routeCasing} lineCap="round" lineJoin="round" />
                <Polyline coordinates={routeCoordinates} strokeWidth={5} strokeColor={MAP_COLORS.route} lineCap="round" lineJoin="round" />
              </>
            ) : null}
            {staticMapMarkers.map(renderMarker)}
          </MapView>
        ) : shouldRenderStaticMap ? (
          <View style={styles.webMapFrame} testID="google-static-map">
            <Image
              source={{ uri: staticMapUrl ?? undefined }}
              style={styles.webMapImage}
              resizeMode="cover"
              onLoad={() => {
                setHasMapLoaded(true);
                setStaticMapFailed(false);
              }}
              onError={() => {
                console.warn('Google static map failed to load, keeping map fallback active');
                setStaticMapFailed(true);
              }}
            />
          </View>
        ) : shouldRenderCleanFallback ? (
          <View style={styles.cleanFallback} testID="map-clean-fallback">
            <View style={styles.cleanFallbackBadge}>
              <Text style={styles.cleanFallbackBadgeText}>Google Maps</Text>
            </View>
            <Text style={styles.cleanFallbackTitle}>Map is reconnecting</Text>
            <Text style={styles.cleanFallbackSubtitle}>We are keeping your trip active while the live map refreshes.</Text>
          </View>
        ) : (
          <View style={styles.cleanFallback} testID="google-token-fallback">
            <View style={styles.cleanFallbackBadge}>
              <Text style={styles.cleanFallbackBadgeText}>Google Maps</Text>
            </View>
            <Text style={styles.cleanFallbackTitle}>Google Maps is not configured</Text>
            <Text style={styles.cleanFallbackSubtitle}>Add a valid Google Maps API key to load live Nigeria maps.</Text>
          </View>
        )}

        {fullScreen && Platform.OS !== 'web' && !preferStaticMap && (
          <>
            <Pressable
              style={[styles.mapControl, { top: controlsTop }, compassEnabled && styles.compassButtonActive]}
              onPress={toggleCompass}
              testID="map-compass-toggle"
            >
              <Compass size={22} color={compassEnabled ? Colors.light.white : Colors.light.primary} />
            </Pressable>

            <Pressable
              style={[styles.mapControl, { top: controlsTop + CONTROL_SPACING }]}
              onPress={recenterMap}
              testID="map-recenter-button"
            >
              <Navigation size={22} color={Colors.light.primary} />
            </Pressable>
          </>
        )}
      </View>

      {isLoadingRoute && (
        <View style={[styles.loadingContainer, mapPadding ? { top: (mapPadding.top ?? 0) + CONTROLS_GAP } : null]}>
          <Skeleton width={110} height={14} borderRadius={4} />
        </View>
      )}

      {!fullScreen && routeInfo && (
        <View style={styles.routeInfo} testID="map-route-info">
          <Text style={styles.routeInfoText}>
            {(routeInfo.distance / 1000).toFixed(1)} km • {Math.round(routeInfo.duration / 60)} min
          </Text>
        </View>
      )}

      {!fullScreen && (showDrivers || activeRouteStart || activeRouteEnd) && (
        <View style={styles.locationInfo}>
          {currentRegion && showDrivers && (
            <View style={styles.locationItem}>
              <MapPin size={16} color={Colors.light.primary} />
              <Text style={styles.locationText}>
                Center: {currentRegion.latitude.toFixed(4)}, {currentRegion.longitude.toFixed(4)}
              </Text>
            </View>
          )}
          {activeRouteStart && (
            <View style={styles.locationItem}>
              <View style={styles.pickupMarker}>
                <MapPin size={12} color={Colors.light.white} />
              </View>
              <Text style={styles.locationText}>
                Start: {activeRouteStart.latitude.toFixed(4)}, {activeRouteStart.longitude.toFixed(4)}
              </Text>
            </View>
          )}
          {activeRouteEnd && (
            <View style={styles.locationItem}>
              <View style={styles.dropoffMarker}>
                <MapPin size={12} color={Colors.light.white} />
              </View>
              <Text style={styles.locationText}>
                End: {activeRouteEnd.latitude.toFixed(4)}, {activeRouteEnd.longitude.toFixed(4)}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default React.memo(Map);

const styles = StyleSheet.create({
  container: {
    height: 320,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#EEF2F7',
  },
  fullScreenContainer: {
    flex: 1,
    // Matches the map's land colour so there is no dark flash before tiles draw.
    backgroundColor: MAP_COLORS.land,
  },
  mapHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: Colors.light.white,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
  },
  mapContainer: {
    flex: 1,
  },
  fullScreenMapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  webMapFrame: {
    flex: 1,
    backgroundColor: '#0B1220',
  },
  webMapImage: {
    width: '100%',
    height: '100%',
  },
  cleanFallback: {
    flex: 1,
    backgroundColor: '#07111F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  cleanFallbackBadge: {
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.35)',
  },
  cleanFallbackBadgeText: {
    color: '#E0F2FE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cleanFallbackTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  cleanFallbackSubtitle: {
    marginTop: 10,
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: {
    position: 'absolute',
    top: 18,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  routeInfo: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(11,18,32,0.85)',
  },
  routeInfoText: {
    color: Colors.light.white,
    fontSize: 13,
    fontWeight: '700',
  },
  locationInfo: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.light.white,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  pickupMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary,
  },
  dropoffMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.secondary,
  },
  mapControl: {
    position: 'absolute',
    right: 18,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  compassButtonActive: {
    backgroundColor: Colors.light.primary,
  },
});
