import { Car, Compass, MapPin, Navigation } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Camera, Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as ExpoLocation from 'expo-location';

import Colors from '@/constants/colors';
import { useLocation } from '@/hooks/useLocationStore';
import { useRide } from '@/hooks/useRideStore';
import { GoogleMapsService } from '@/lib/google-maps-service';
import { Location } from '@/types';

interface CustomMarker {
  id: string;
  location: Location;
  title?: string;
  description?: string;
  type?: 'driver' | 'pickup' | 'dropoff';
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
}

const EMPTY_MARKERS: CustomMarker[] = [];

const DEFAULT_DELTA = {
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const DEFAULT_NIGERIA_REGION: Location = {
  latitude: 9.0765,
  longitude: 7.3986,
  latitudeDelta: 0.035,
  longitudeDelta: 0.035,
};

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
}) => {
  const { userLocation, pickupLocation, dropoffLocation, routeInfo: sharedRouteInfo } = useLocation();
  const { nearbyDrivers } = useRide();
  const [currentRegion, setCurrentRegion] = useState<Location | undefined>(undefined);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
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
  const routeRequestKeyRef = useRef<string | null>(null);
  const fittedRouteKeyRef = useRef<string | null>(null);
  const lastAnimatedRegionKeyRef = useRef<string | null>(null);
  const mapLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeRouteStart = routeStartLocation ?? pickupLocation;
  const activeRouteEnd = routeEndLocation ?? dropoffLocation;
  const activeMarkers = customMarkers ?? EMPTY_MARKERS;

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
        markers.push({
          id: `static-driver-${driver.id}`,
          location: driver.location,
          title: driver.name,
          description: `${driver.carModel} - ${driver.rating}⭐`,
          type: 'driver',
        });
      });
    }

    return [...markers, ...activeMarkers];
  }, [activeMarkers, customMarkers, dropoffLocation, nearbyDrivers, pickupLocation, showDrivers]);

  const resolvedInitialRegion = useMemo<Location | undefined>(() => {
    const source = initialRegion ?? activeRouteStart ?? userLocation ?? DEFAULT_NIGERIA_REGION;

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

  useEffect(() => {
    if (!mapRef.current || !resolvedInitialRegion || userInteracted) {
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
  }, [resolvedInitialRegion, userInteracted]);

  useEffect(() => {
    if (Platform.OS === 'web' || !fullScreen) {
      return;
    }

    const startHeadingTracking = async () => {
      try {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
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

          if (headingData.trueHeading !== -1) {
            setHeading(headingData.trueHeading);
            return;
          }

          if (headingData.magHeading !== -1) {
            setHeading(headingData.magHeading);
          }
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
  }, [compassEnabled, fullScreen]);

  const notifyRouteInfoChange = useCallback((info: { distance: number; duration: number } | null) => {
    setRouteInfo(info);
    onRouteInfoChange?.(info);
  }, [onRouteInfoChange]);

  const fetchRoute = useCallback(async () => {
    const routeKey = buildRouteKey(activeRouteStart, activeRouteEnd);

    if (!showRoute || !activeRouteStart || !activeRouteEnd || !routeKey) {
      routeRequestKeyRef.current = null;
      fittedRouteKeyRef.current = null;
      setRouteCoordinates([]);
      setRoutePolyline('');
      notifyRouteInfoChange(null);
      return;
    }

    const isSharedPickupDropoffRoute = Boolean(
      pickupLocation &&
      dropoffLocation &&
      activeRouteStart &&
      activeRouteEnd &&
      buildRouteKey(pickupLocation, dropoffLocation) === routeKey
    );

    if (isSharedPickupDropoffRoute && sharedRouteInfo?.coordinates?.length) {
      console.log('Using shared route info from location store for key:', routeKey);
      routeRequestKeyRef.current = routeKey;
      setRouteCoordinates(sharedRouteInfo.coordinates);
      setRoutePolyline(sharedRouteInfo.polyline ?? '');
      notifyRouteInfoChange({
        distance: sharedRouteInfo.distance,
        duration: sharedRouteInfo.duration,
      });

      if (!userInteracted && mapRef.current && fittedRouteKeyRef.current !== routeKey) {
        fittedRouteKeyRef.current = routeKey;
        requestAnimationFrame(() => {
          mapRef.current?.fitToCoordinates(sharedRouteInfo.coordinates, {
            edgePadding: {
              top: fullScreen ? 160 : 100,
              right: 48,
              bottom: fullScreen ? 320 : 100,
              left: 48,
            },
            animated: true,
          });
        });
      }
      return;
    }

    if (routeRequestKeyRef.current === routeKey) {
      console.log('Skipping duplicate map route fetch for key:', routeKey);
      return;
    }

    routeRequestKeyRef.current = routeKey;
    setIsLoadingRoute(true);
    console.log('Fetching map route for key:', routeKey);

    try {
      let directions = await GoogleMapsService.getDirections(activeRouteStart, activeRouteEnd);

      if (!directions) {
        console.log('Retrying map route fetch once after failure...');
        directions = await GoogleMapsService.getDirections(activeRouteStart, activeRouteEnd);
      }

      if (!directions) {
        console.error('Route fetch still failed after retry');
        setRouteCoordinates([]);
        setRoutePolyline('');
        notifyRouteInfoChange(null);
        fittedRouteKeyRef.current = null;
        return;
      }

      const info = {
        distance: directions.distance,
        duration: directions.duration,
      };

      setRouteCoordinates(directions.coordinates);
      setRoutePolyline(directions.polyline ?? '');
      notifyRouteInfoChange(info);

      if (!userInteracted && mapRef.current && fittedRouteKeyRef.current !== routeKey && directions.coordinates.length > 0) {
        fittedRouteKeyRef.current = routeKey;
        requestAnimationFrame(() => {
          mapRef.current?.fitToCoordinates(directions.coordinates, {
            edgePadding: {
              top: fullScreen ? 160 : 100,
              right: 48,
              bottom: fullScreen ? 320 : 100,
              left: 48,
            },
            animated: true,
          });
        });
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      setRouteCoordinates([]);
      setRoutePolyline('');
      notifyRouteInfoChange(null);
      fittedRouteKeyRef.current = null;
    } finally {
      setIsLoadingRoute(false);
    }
  }, [activeRouteEnd, activeRouteStart, dropoffLocation, fullScreen, notifyRouteInfoChange, pickupLocation, sharedRouteInfo, showRoute, userInteracted]);

  useEffect(() => {
    void fetchRoute();
  }, [fetchRoute]);

  const handleRegionChangeComplete = useCallback((nextRegion: Region) => {
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
  }, [currentRegion, onRegionChange]);

  const toggleCompass = useCallback(() => {
    setCompassEnabled((prev: boolean) => {
      if (prev) {
        setHeading(0);
      }
      return !prev;
    });
  }, []);

  const recenterMap = useCallback(() => {
    if (!userLocation || !mapRef.current) {
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
      zoom: 15,
    };

    mapRef.current.animateCamera(camera, { duration: 300 });
    setCurrentRegion({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: DEFAULT_DELTA.latitudeDelta,
      longitudeDelta: DEFAULT_DELTA.longitudeDelta,
    });
    setFollowUserLocation(true);
    setUserInteracted(false);
  }, [compassEnabled, heading, userLocation]);

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
            initialRegion={resolvedInitialRegion as Region}
            showsUserLocation={Boolean(userLocation)}
            showsMyLocationButton={false}
            showsCompass={false}
            onMapReady={() => {
              setHasMapLoaded(true);
              setUseCleanFallback(false);
            }}
            onRegionChangeComplete={handleRegionChangeComplete}
            onPanDrag={() => {
              setUserInteracted(true);
              setFollowUserLocation(false);
            }}
            testID="google-native-map"
          >
            {showRoute && routeCoordinates.length > 0 ? (
              <Polyline coordinates={routeCoordinates} strokeWidth={5} strokeColor={Colors.light.primary} />
            ) : null}
            {staticMapMarkers.map((marker) => (
              <Marker
                key={marker.id}
                coordinate={{ latitude: marker.location.latitude, longitude: marker.location.longitude }}
                title={marker.title}
                description={marker.description}
              />
            ))}
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
            {staticMapMarkers.map((marker) => (
              <View
                key={`overlay-${marker.id}`}
                style={[
                  styles.staticMarkerOverlay,
                  marker.type === 'dropoff' ? styles.staticDropoffMarkerOverlay : null,
                  marker.type === 'driver' ? styles.staticDriverMarkerOverlay : null,
                ]}
              />
            ))}
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
              style={[styles.compassButton, compassEnabled && styles.compassButtonActive]}
              onPress={toggleCompass}
              testID="map-compass-toggle"
            >
              <Compass size={22} color={compassEnabled ? Colors.light.white : Colors.light.primary} />
            </Pressable>

            <Pressable
              style={styles.recenterButton}
              onPress={recenterMap}
              testID="map-recenter-button"
            >
              <Navigation size={22} color={Colors.light.primary} />
            </Pressable>
          </>
        )}
      </View>

      {GoogleMapsService.hasApiKey && !shouldRenderCleanFallback ? (
        <View style={styles.mapProviderBadge} testID="map-provider-badge">
          <Text style={styles.mapProviderBadgeText}>Google Maps</Text>
        </View>
      ) : null}

      {isLoadingRoute && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Loading route...</Text>
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
    backgroundColor: '#0B1220',
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
  driverMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary,
    borderWidth: 2,
    borderColor: Colors.light.white,
  },
  liveDriverMarker: {
    backgroundColor: '#0F172A',
    borderColor: '#BAE6FD',
  },
  mapProviderBadge: {
    position: 'absolute',
    top: 18,
    left: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(8,15,28,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.28)',
  },
  mapProviderBadgeText: {
    color: '#E0F2FE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
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
  loadingFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
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
  compassButton: {
    position: 'absolute',
    right: 18,
    top: 86,
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
  recenterButton: {
    position: 'absolute',
    right: 18,
    top: 142,
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
});