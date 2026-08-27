import { ArrowLeft, Clock, LocateFixed, MapPin, X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Animated,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import { SkeletonRow, ShimmerGroup } from "@/components/skeletons";
import { useLocation } from "@/hooks/useLocationStore";
import { Location as LocationType } from "@/types";
import { AutocompleteResult, GoogleMapsService, PlaceResult } from "@/lib/google-maps-service";
import { calculateFare, calculateAllTierFares } from "@/lib/fare-calculator";

interface PlaceWithPrice extends PlaceResult {
  estimatedPrice?: number;
  distance?: number;
  duration?: number;
  isEstimate?: boolean;
  ridePrices?: {
    rideType: string;
    price: number;
  }[];
}


export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const {
    userLocation,
    pickupLocation,
    pickupAddress,
    dropoffAddress,
    locationError,
    retryLocation,
    setPickupLocation,
    setPickupAddress,
    setDropoffLocation,
    setDropoffAddress,
    saveRecentLocation,
    getRecentLocations,
    clearRoute,
  } = useLocation();

  // `isEditMode` is only true when this screen was reached from an already-open
  // ride-confirmation screen (its Pickup/Destination rows always pass `target`
  // explicitly) — as opposed to the original "Where to?" entry point on the home
  // screen, which never sets it. This changes what happens after a selection: in
  // edit mode, any selection just updates that one field and returns to
  // ride-confirmation; on fresh entry, picking a destination is what completes the
  // flow and moves forward (picking a pickup instead just hands off to the
  // destination field, since a pickup alone isn't enough to start a trip).
  const rawTarget = params.target as string | undefined;
  const isEditMode = rawTarget !== undefined;
  const [activeField, setActiveField] = useState<'pickup' | 'dropoff'>(
    rawTarget === 'pickup' ? 'pickup' : 'dropoff'
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PlaceWithPrice[]>([]);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<AutocompleteResult[]>([]);
  const [useAutocomplete, setUseAutocomplete] = useState(true);
  const [recentLocations, setRecentLocations] = useState<any[]>([]);
  const [fadeAnim] = useState(new Animated.Value(0));
  const hasHandledPrefilledDestination = useRef<boolean>(false);
  const activeSearchRequestRef = useRef<number>(0);
  const nearbyCategories = GoogleMapsService.getNearbyCategories();

  const loadRecentLocations = useCallback(async () => {
    const locations = await getRecentLocations();
    setRecentLocations(locations);
  }, [getRecentLocations]);

  const calculatePrice = useCallback((distanceMeters: number, durationSeconds = 0): number => {
    return calculateFare(distanceMeters / 1000, durationSeconds / 60, 'standard');
  }, []);

  const calculateAllRidePrices = useCallback((distanceMeters: number, durationSeconds = 0) => {
    const fares = calculateAllTierFares(distanceMeters / 1000, durationSeconds / 60);
    return Object.entries(fares).map(([id, price]) => ({
      rideType: id.charAt(0).toUpperCase() + id.slice(1),
      price,
    }));
  }, []);

  // Clears the query/results and hands the active TextInput off to the other row —
  // used after setting a pickup on fresh entry, since a pickup alone isn't enough
  // to proceed and the natural next step is typing the destination.
  const switchActiveField = useCallback((field: 'pickup' | 'dropoff') => {
    setActiveField(field);
    setSearchQuery("");
    setSearchResults([]);
    setAutocompleteSuggestions([]);
    setUseAutocomplete(true);
  }, []);

  const handleLocationSelect = useCallback(async (item: PlaceWithPrice) => {
    console.log('Selected location:', item);
    Keyboard.dismiss();
    // Clearing the cached route here is load-bearing: it's what makes
    // ride-confirmation.tsx recompute price/route after either a pickup or a
    // destination edit, not just on the very first navigation into it.
    clearRoute();

    if (activeField === 'pickup') {
      setPickupLocation(item.location);
      setPickupAddress(item.address || item.name);
    } else {
      setDropoffLocation(item.location);
      setDropoffAddress(item.address || item.name);
    }

    await saveRecentLocation(item.location, item.address || item.name);

    if (isEditMode) {
      // Reached from an already-mounted ride-confirmation screen to edit a field —
      // go back to it (preserving its bookingFor/passenger state) instead of
      // pushing a second, freshly-mounted instance on top.
      router.back();
    } else if (activeField === 'dropoff') {
      // Destination is the signal that the trip is ready to preview.
      router.push("/ride-confirmation");
    } else {
      // Just set pickup on a fresh "Where to?" entry — hand off to destination
      // instead of navigating away, since pickup alone doesn't start a trip.
      switchActiveField('dropoff');
    }
  }, [clearRoute, activeField, isEditMode, setPickupLocation, setPickupAddress, setDropoffLocation, setDropoffAddress, saveRecentLocation, router, switchActiveField]);

  const handleUseCurrentLocation = useCallback(async () => {
    if (!userLocation) return;
    Keyboard.dismiss();
    clearRoute();
    setPickupLocation(userLocation);
    setPickupAddress('Current Location');

    if (isEditMode) {
      router.back();
    } else {
      switchActiveField('dropoff');
    }
  }, [userLocation, clearRoute, setPickupLocation, setPickupAddress, isEditMode, router, switchActiveField]);

  const handleAutocompleteSelect = useCallback(async (item: AutocompleteResult) => {
    console.log('Selected autocomplete:', item);
    setIsSearching(true);
    Keyboard.dismiss();

    try {
      await handleLocationSelect({
        id: item.placeId,
        name: item.name,
        address: item.address,
        location: item.location,
      });
    } catch (error) {
      console.error('Error selecting autocomplete location:', error);
    } finally {
      setIsSearching(false);
    }
  }, [handleLocationSelect]);

  useEffect(() => {
    void loadRecentLocations();

    if (
      rawTarget === 'pickup' ||
      hasHandledPrefilledDestination.current ||
      !params.destination ||
      !params.destinationAddress ||
      !params.destinationLat ||
      !params.destinationLng
    ) {
      return;
    }

    const destinationLocation: LocationType = {
      latitude: parseFloat(params.destinationLat as string),
      longitude: parseFloat(params.destinationLng as string),
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };

    const destinationItem: PlaceResult = {
      id: 'discover-destination',
      name: params.destination as string,
      address: params.destinationAddress as string,
      location: destinationLocation,
    };

    hasHandledPrefilledDestination.current = true;
    void handleLocationSelect(destinationItem);
  }, [rawTarget, handleLocationSelect, loadRecentLocations, params.destination, params.destinationAddress, params.destinationLat, params.destinationLng]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery.length > 1) {
        const requestId = Date.now();
        activeSearchRequestRef.current = requestId;

        const search = async () => {
          if (searchQuery.trim() === "") {
            return;
          }

          setIsSearching(true);
          try {
            if (useAutocomplete) {
              const suggestions = await GoogleMapsService.autocomplete(searchQuery, userLocation || undefined);

              if (activeSearchRequestRef.current !== requestId) {
                return;
              }

              if (suggestions.length > 0) {
                console.log('✅ Autocomplete suggestions loaded:', suggestions.length);
                setAutocompleteSuggestions(suggestions);
                setSearchResults([]);
              } else {
                console.log('⚠️ No autocomplete results returned from Google Maps, switching to place search');
                const fallbackResults = await GoogleMapsService.searchPlaces(searchQuery, userLocation || undefined);

                if (activeSearchRequestRef.current !== requestId) {
                  return;
                }

                setAutocompleteSuggestions([]);
                setSearchResults(fallbackResults);
              }
            } else {
              const results = await GoogleMapsService.searchPlaces(searchQuery, userLocation || undefined);

              if (activeSearchRequestRef.current !== requestId) {
                return;
              }

              const origin = pickupLocation || userLocation;
              if (origin) {
                const resultsWithPrice = await Promise.all(
                  results.map(async (place) => {
                    try {
                      const directions = await GoogleMapsService.getDirections(origin, place.location);
                      if (directions) {
                        return {
                          ...place,
                          distance: directions.distance,
                          duration: directions.duration,
                          isEstimate: directions.isEstimate,
                          estimatedPrice: calculatePrice(directions.distance, directions.duration),
                          ridePrices: calculateAllRidePrices(directions.distance, directions.duration),
                        };
                      }
                    } catch (error) {
                      console.error('Error getting directions for place:', error);
                    }
                    return place;
                  })
                );

                if (activeSearchRequestRef.current !== requestId) {
                  return;
                }

                setSearchResults(resultsWithPrice);
                setAutocompleteSuggestions([]);
              } else {
                setSearchResults(results);
                setAutocompleteSuggestions([]);
              }
            }
          } catch (error) {
            console.error("Error searching locations:", error);
            if (activeSearchRequestRef.current === requestId) {
              setSearchResults([]);
              setAutocompleteSuggestions([]);
            }
          } finally {
            if (activeSearchRequestRef.current === requestId) {
              setIsSearching(false);
            }
          }
        };
        void search();
      } else {
        activeSearchRequestRef.current = 0;
        setSearchResults([]);
        setAutocompleteSuggestions([]);
        setUseAutocomplete(true);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, userLocation, pickupLocation, calculatePrice, calculateAllRidePrices, useAutocomplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setAutocompleteSuggestions([]);
    setUseAutocomplete(true);
  };

  const handleNearbyCategoryPress = useCallback((query: string) => {
    console.log('Selected nearby category query:', query);
    setUseAutocomplete(false);
    setSearchQuery(query);
  }, []);

  const renderAutocompleteItem = ({ item }: { item: AutocompleteResult }) => (
    <Pressable
      style={({ pressed }) => [
        styles.locationItem,
        pressed && styles.locationItemPressed,
      ]}
      onPress={() => handleAutocompleteSelect(item)}
      testID={`search-autocomplete-${item.id}`}
    >
      <View style={styles.locationIconContainer}>
        <MapPin size={20} color={Colors.light.primary} />
      </View>
      <View style={styles.locationInfo}>
        <Text style={styles.locationName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.locationAddress} numberOfLines={2}>{item.address}</Text>
      </View>
    </Pressable>
  );

  const renderLocationItem = ({ item }: { item: PlaceWithPrice }) => (
    <Pressable
      style={({ pressed }) => [
        styles.locationItem,
        pressed && styles.locationItemPressed,
      ]}
      onPress={() => handleLocationSelect(item)}
      testID={`search-place-${item.id}`}
    >
      <View style={styles.locationIconContainer}>
        <MapPin size={20} color={Colors.light.secondary} />
      </View>
      <View style={styles.locationInfo}>
        <Text style={styles.locationName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.locationAddress} numberOfLines={1}>{item.address}</Text>
        {item.distance && item.duration && (
          <View style={styles.distanceContainer}>
            <Text style={styles.distanceText}>
              {(item.distance / 1000).toFixed(1)} km • {Math.round(item.duration / 60)} min
            </Text>
          </View>
        )}
        {item.ridePrices && item.ridePrices.length > 0 && (
          <View style={styles.ridePricesContainer}>
            {item.ridePrices.slice(0, 2).map((ridePrice, index) => (
              <View key={index} style={styles.ridePriceItem}>
                <Text style={styles.ridePriceType}>{ridePrice.rideType}</Text>
                <Text style={styles.ridePriceValue}>₦{ridePrice.price.toFixed(0)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      {item.estimatedPrice && (
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>{item.isEstimate ? "Est. from" : "From"}</Text>
          <Text style={styles.priceText}>₦{item.estimatedPrice.toFixed(0)}</Text>
        </View>
      )}
    </Pressable>
  );

  const renderRecentLocationItem = ({ item }: { item: any }) => (
    <Pressable
      style={({ pressed }) => [
        styles.locationItem,
        pressed && styles.locationItemPressed,
      ]}
      onPress={() => handleLocationSelect({
        id: Math.random().toString(),
        name: item.address,
        address: item.address,
        location: item.location,
      })}
      testID={`search-recent-${String(item.address).replace(/\s+/g, '-').toLowerCase()}`}
    >
      <View style={[styles.locationIconContainer, styles.recentIconContainer]}>
        <Clock size={20} color={Colors.light.gray} />
      </View>
      <View style={styles.locationInfo}>
        <Text style={styles.locationName} numberOfLines={1}>{item.address}</Text>
        <Text style={styles.locationAddress}>Recent</Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: activeField === 'pickup' ? 'Set pickup' : 'Set destination' }} />
      <Animated.View style={[styles.searchContainer, { opacity: fadeAnim }] }>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          testID="search-back-button"
        >
          <ArrowLeft size={24} color={Colors.light.secondary} />
        </Pressable>

        <View style={styles.searchColumn}>
          <View style={styles.routeFieldGroup}>
            {activeField === 'pickup' ? (
              <View style={styles.inputContainer}>
                <View style={[styles.routeDot, styles.routeDotPickup]} />
                <TextInput
                  style={styles.input}
                  placeholder="Where should we pick up from?"
                  placeholderTextColor={Colors.light.gray}
                  value={searchQuery}
                  onChangeText={(text) => {
                    setUseAutocomplete(true);
                    setSearchQuery(text);
                  }}
                  autoFocus
                  returnKeyType="search"
                  testID="search-input"
                />
                {searchQuery.length > 0 && (
                  <Pressable style={styles.clearButton} onPress={clearSearch} testID="search-clear-button">
                    <X size={20} color={Colors.light.gray} />
                  </Pressable>
                )}
              </View>
            ) : (
              <Pressable
                style={styles.routeSummaryRow}
                onPress={() => switchActiveField('pickup')}
                testID="search-from-row"
              >
                <View style={[styles.routeDot, styles.routeDotPickup]} />
                <Text style={styles.routeSummaryText} numberOfLines={1}>
                  {pickupAddress || 'Current location'}
                </Text>
              </Pressable>
            )}

            <View style={styles.routeFieldDivider} />

            {activeField === 'dropoff' ? (
              <View style={styles.inputContainer}>
                <View style={[styles.routeDot, styles.routeDotDropoff]} />
                <TextInput
                  style={styles.input}
                  placeholder="Where to?"
                  placeholderTextColor={Colors.light.gray}
                  value={searchQuery}
                  onChangeText={(text) => {
                    setUseAutocomplete(true);
                    setSearchQuery(text);
                  }}
                  autoFocus
                  returnKeyType="search"
                  testID="search-input"
                />
                {searchQuery.length > 0 && (
                  <Pressable style={styles.clearButton} onPress={clearSearch} testID="search-clear-button">
                    <X size={20} color={Colors.light.gray} />
                  </Pressable>
                )}
              </View>
            ) : (
              <Pressable
                style={styles.routeSummaryRow}
                onPress={() => switchActiveField('dropoff')}
                testID="search-to-row"
              >
                <View style={[styles.routeDot, styles.routeDotDropoff]} />
                <Text style={styles.routeSummaryText} numberOfLines={1}>
                  {dropoffAddress || 'Where to?'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Animated.View>

      {isSearching ? (
        <ShimmerGroup>
          <View style={styles.skeletonRowsContainer}>
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonRow key={i} leadingSize={44} />
            ))}
          </View>
        </ShimmerGroup>
      ) : (
        <>
          {autocompleteSuggestions.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Suggested Places</Text>
              <FlatList
                data={autocompleteSuggestions}
                renderItem={renderAutocompleteItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
              />
            </>
          ) : searchResults.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Suggested Places</Text>
              <FlatList
                data={searchResults}
                renderItem={renderLocationItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
              />
            </>
          ) : (
            <>
              {searchQuery.length > 0 ? (
                <View style={styles.emptyContainer}>
                  <MapPin size={48} color={Colors.light.lightGray} />
                  <Text style={styles.emptyText}>No places found</Text>
                  <Text style={styles.emptySubtext}>Try a different search</Text>
                </View>
              ) : (
                <>
                  {activeField === 'pickup' && userLocation && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.locationItem,
                        pressed && styles.locationItemPressed,
                      ]}
                      onPress={handleUseCurrentLocation}
                      testID="search-use-current-location"
                    >
                      <View style={[styles.locationIconContainer, styles.currentLocationIconContainer]}>
                        <LocateFixed size={20} color={Colors.light.primary} />
                      </View>
                      <View style={styles.locationInfo}>
                        <Text style={styles.locationName} numberOfLines={1}>Use current location</Text>
                        <Text style={styles.locationAddress} numberOfLines={1}>{pickupAddress || 'Current Location'}</Text>
                      </View>
                    </Pressable>
                  )}

                  {activeField === 'pickup' && !userLocation && locationError && (
                    <View style={styles.locationErrorRow} testID="search-location-error">
                      <LocateFixed size={20} color={Colors.light.gray} />
                      <View style={styles.locationInfo}>
                        <Text style={styles.locationName} numberOfLines={1}>{locationError}</Text>
                        <Pressable onPress={() => void retryLocation()}>
                          <Text style={styles.locationErrorRetryText}>Retry</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  <Text style={styles.sectionTitle}>Near Me</Text>
                  <View style={styles.categoryGrid}>
                    {nearbyCategories.map((category) => (
                      <Pressable
                        key={category.id}
                        style={({ pressed }) => [styles.categoryChip, pressed && styles.categoryChipPressed]}
                        onPress={() => handleNearbyCategoryPress(category.query)}
                        testID={`nearby-category-${category.id}`}
                      >
                        <Text style={styles.categoryChipText}>{category.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {recentLocations.length > 0 && (
                    <>
                      <Text style={styles.sectionTitle}>Recent</Text>
                      <FlatList
                        data={recentLocations}
                        renderItem={renderRecentLocationItem}
                        keyExtractor={(_, index) => index.toString()}
                        contentContainerStyle={styles.listContent}
                        keyboardShouldPersistTaps="handled"
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.lightGray,
  },
  searchColumn: {
    flex: 1,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  routeFieldGroup: {
    backgroundColor: Colors.light.lightGray,
    borderRadius: 16,
    paddingHorizontal: 12,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  routeSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  routeSummaryText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.gray,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeDotPickup: {
    backgroundColor: '#14B8A6',
    marginRight: 8,
  },
  routeDotDropoff: {
    backgroundColor: Colors.light.secondary,
    marginRight: 8,
  },
  routeFieldDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.border,
    marginLeft: 16,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: Colors.light.text,
  },
  clearButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.gray,
  },
  skeletonRowsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.light.gray,
  },
  listContent: {
    paddingBottom: 20,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 10,
  },
  categoryChip: {
    backgroundColor: Colors.light.white,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  categoryChipPressed: {
    backgroundColor: Colors.light.primaryLight,
    borderColor: Colors.light.primary,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.secondary,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.lightGray,
  },
  locationItemPressed: {
    backgroundColor: Colors.light.lightGray,
  },
  locationErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  locationErrorRetryText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.light.primary,
    marginTop: 2,
  },
  locationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.secondary + "20",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  recentIconContainer: {
    backgroundColor: Colors.light.lightGray,
  },
  currentLocationIconContainer: {
    backgroundColor: Colors.light.primaryLight,
  },
  locationInfo: {
    flex: 1,
    marginRight: 12,
  },
  locationName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
  },
  locationAddress: {
    fontSize: 13,
    color: Colors.light.gray,
    marginTop: 4,
  },
  distanceContainer: {
    marginTop: 6,
  },
  distanceText: {
    fontSize: 12,
    color: Colors.light.primary,
    fontWeight: "500",
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  priceLabel: {
    fontSize: 11,
    color: Colors.light.gray,
  },
  priceText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.primary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  ridePricesContainer: {
    flexDirection: "row",
    marginTop: 8,
    gap: 8,
  },
  ridePriceItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.lightGray,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ridePriceType: {
    fontSize: 11,
    color: Colors.light.gray,
    marginRight: 4,
  },
  ridePriceValue: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.primary,
  },
});