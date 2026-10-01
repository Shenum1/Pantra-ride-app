import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import { Location as LocationType } from "@/types";
import { GoogleMapsService, DirectionsResult } from "@/lib/google-maps-service";

export const [LocationProvider, useLocation] = createContextHook(() => {
  const [userLocation, setUserLocation] = useState<LocationType | null>(null);
  const [pickupLocation, setPickupLocation] = useState<LocationType | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<LocationType | null>(null);
  const [pickupAddress, setPickupAddress] = useState<string>("");
  const [dropoffAddress, setDropoffAddress] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<DirectionsResult | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);
  const lastRouteKeyRef = useRef<string | null>(null);
  const activeRouteKeyRef = useRef<string | null>(null);

  const retryLocation = useCallback(async () => {
    try {
      setIsLoading(true);
      setLocationError(null);

      if (Platform.OS === 'web') {
        // Use web geolocation API
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const newLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              };
              setUserLocation(newLocation);
              setPickupLocation(newLocation);
              setPickupAddress("Current Location");
              setHasPermission(true);
              setLocationError(null);
              setIsLoading(false);
            },
            (error) => {
              console.log("Web geolocation error:", error);
              setUserLocation(null);
              setPickupLocation(null);
              setPickupAddress("");
              setHasPermission(false);
              setLocationError("Location unavailable");
              setIsLoading(false);
            }
          );
        } else {
          // Geolocation not supported
          setUserLocation(null);
          setPickupLocation(null);
          setPickupAddress("");
          setHasPermission(false);
          setLocationError("Location services not supported");
          setIsLoading(false);
        }
      } else {
        // Use expo-location for mobile
        const { status } = await Location.requestForegroundPermissionsAsync();
        setHasPermission(status === "granted");

        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({});
          const newLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
          setUserLocation(newLocation);
          setPickupLocation(newLocation);
          setLocationError(null);

          // Get address for current location
          const addresses = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });

          if (addresses && addresses.length > 0) {
            const address = addresses[0];
            const formattedAddress = `${address.street || ""} ${address.name || ""}, ${address.city || ""}`;
            setPickupAddress(formattedAddress);
          }
        } else {
          // No default location — surface the denial explicitly instead of
          // silently booking off a fake coordinate.
          setUserLocation(null);
          setPickupLocation(null);
          setPickupAddress("");
          setLocationError("Location permission denied");

          Alert.alert(
            "Location Permission Required",
            "Please enable location services to use all features of this app.",
            [{ text: "OK" }]
          );
        }
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error getting location:", error);
      setUserLocation(null);
      setPickupLocation(null);
      setPickupAddress("");
      setHasPermission(false);
      setLocationError("Location unavailable");
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void retryLocation();
  }, [retryLocation]);

  const getRecentLocations = useCallback(async () => {
    try {
      const locations = await AsyncStorage.getItem('recentLocations');
      return locations ? JSON.parse(locations) : [];
    } catch (error) {
      console.error("Error getting recent locations:", error);
      return [];
    }
  }, []);

  const saveRecentLocation = useCallback(async (location: LocationType, address: string) => {
    try {
      const recentLocations = await getRecentLocations();
      const newLocation = { location, address, timestamp: new Date().toISOString() };
      const updatedLocations = [newLocation, ...recentLocations.filter(
        (loc: any) => loc.address !== address
      )].slice(0, 5);

      await AsyncStorage.setItem('recentLocations', JSON.stringify(updatedLocations));
    } catch (error) {
      console.error("Error saving recent location:", error);
    }
  }, [getRecentLocations]);

  const calculateRoute = useCallback(async (pickup: LocationType, dropoff: LocationType): Promise<DirectionsResult | null> => {
    const routeKey = [
      pickup.latitude.toFixed(5),
      pickup.longitude.toFixed(5),
      dropoff.latitude.toFixed(5),
      dropoff.longitude.toFixed(5),
    ].join(':');

    if (activeRouteKeyRef.current === routeKey) {
      console.log('Skipping duplicate in-flight route calculation for key:', routeKey);
      return routeInfo;
    }

    if (lastRouteKeyRef.current === routeKey && routeInfo) {
      console.log('Reusing cached route result for key:', routeKey);
      return routeInfo;
    }

    activeRouteKeyRef.current = routeKey;
    setIsCalculatingRoute(true);
    console.log('Calculating route from', pickup, 'to', dropoff, 'with key:', routeKey);

    try {
      let directions = await GoogleMapsService.getDirections(pickup, dropoff);

      if (!directions) {
        console.log('Route request failed, retrying once...');
        directions = await GoogleMapsService.getDirections(pickup, dropoff);
      }

      if (directions) {
        console.log('Route calculated:', {
          distance: directions.distance,
          duration: directions.duration,
          points: directions.coordinates.length,
        });
        lastRouteKeyRef.current = routeKey;
        setRouteInfo(directions);
        return directions;
      }

      console.log('No route found after retry');
      lastRouteKeyRef.current = null;
      setRouteInfo(null);
      return null;
    } catch (error) {
      console.error('Error calculating route:', error);
      lastRouteKeyRef.current = null;
      setRouteInfo(null);
      return null;
    } finally {
      activeRouteKeyRef.current = null;
      setIsCalculatingRoute(false);
    }
  }, [routeInfo]);

  const clearRoute = useCallback(() => {
    lastRouteKeyRef.current = null;
    activeRouteKeyRef.current = null;
    setRouteInfo(null);
  }, []);

  return React.useMemo(() => ({
    userLocation,
    pickupLocation,
    dropoffLocation,
    pickupAddress,
    dropoffAddress,
    isLoading,
    hasPermission,
    locationError,
    retryLocation,
    routeInfo,
    isCalculatingRoute,
    setUserLocation,
    setPickupLocation,
    setDropoffLocation,
    setPickupAddress,
    setDropoffAddress,
    saveRecentLocation,
    getRecentLocations,
    calculateRoute,
    clearRoute,
  }), [
    userLocation,
    pickupLocation,
    dropoffLocation,
    pickupAddress,
    dropoffAddress,
    isLoading,
    hasPermission,
    locationError,
    retryLocation,
    routeInfo,
    isCalculatingRoute,
    saveRecentLocation,
    getRecentLocations,
    calculateRoute,
    clearRoute,
  ]);
});