import { ArrowLeft, Clock, MapPin, Search, Sparkles, X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useRouter, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import { useLocation } from "@/hooks/useLocationStore";
import { Location as LocationType } from "@/types";
import { AutocompleteResult, GoogleMapsService, PlaceResult } from "@/lib/google-maps-service";
import { calculateFare, calculateAllTierFares } from "@/lib/fare-calculator";

interface PlaceWithPrice extends PlaceResult {
  estimatedPrice?: number;
  distance?: number;
  duration?: number;
  ridePrices?: {
    rideType: string;
    price: number;
  }[];
}


export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { userLocation, pickupLocation, setDropoffLocation, setDropoffAddress, saveRecentLocation, getRecentLocations, clearRoute } = useLocation();
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

  const handleLocationSelect = useCallback(async (item: PlaceWithPrice) => {
    console.log('Selected location:', item);
    Keyboard.dismiss();
    clearRoute();
    setDropoffLocation(item.location);
    setDropoffAddress(item.address || item.name);

    await saveRecentLocation(item.location, item.address || item.name);

    router.push("/ride-confirmation");
  }, [clearRoute, setDropoffLocation, setDropoffAddress, saveRecentLocation, router]);

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
  }, [handleLocationSelect, loadRecentLocations, params.destination, params.destinationAddress, params.destinationLat, params.destinationLng]);

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
          <Text style={styles.priceLabel}>From</Text>
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
      <Animated.View style={[styles.searchContainer, { opacity: fadeAnim }] }>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          testID="search-back-button"
        >
          <ArrowLeft size={24} color={Colors.light.secondary} />
        </Pressable>

        <View style={styles.searchColumn}>
          <View style={styles.inputContainer}>
            <MapPin size={18} color={Colors.light.gray} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Search shops, hotels, restaurants..."
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

          <View style={styles.helperRow}>
            <View style={styles.helperChip}>
              <Sparkles size={14} color={Colors.light.primary} />
              <Text style={styles.helperChipText}>Nigeria POIs</Text>
            </View>
            <View style={styles.helperChipMuted}>
              <Search size={14} color={Colors.light.gray} />
              <Text style={styles.helperChipMutedText}>Try Shoprite, Transcorp, Eko Hotels</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Searching for places...</Text>
        </View>
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
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.lightGray,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  helperRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  helperChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  helperChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.light.primary,
  },
  helperChipMuted: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: Colors.light.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  helperChipMutedText: {
    fontSize: 12,
    color: Colors.light.gray,
    fontWeight: "500",
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