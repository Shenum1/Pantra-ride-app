import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Image,
  FlatList,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  MapPin,
  Star,
  Clock,
  Navigation,
  Hotel,
  Coffee,
  ShoppingBag,
  TreePine,
  Utensils,
  Car,
  Building,
  Camera,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useThemeStore';
import { useWeather } from '@/hooks/useWeatherStore';
import { useLocation } from '@/hooks/useLocationStore';
import WeatherCard from '@/components/WeatherCard';
import { router } from 'expo-router';
import { Location } from '@/types';
import { GoogleMapsService, NearbyPlaceResult } from '@/lib/google-maps-service';

interface Place {
  id: string;
  name: string;
  category: string;
  rating: number;
  distance: string;
  image: string;
  address: string;
  openHours?: string;
  priceRange?: string;
  description: string;
  location?: Location;
}

interface Category {
  id: string;
  name: string;
  icon: React.ReactElement;
  color: string;
}

const categories: Category[] = [
  { id: 'hotels', name: 'Hotels', icon: <Hotel size={24} color="#fff" />, color: '#FF6B6B' },
  { id: 'restaurants', name: 'Restaurants', icon: <Utensils size={24} color="#fff" />, color: '#4ECDC4' },
  { id: 'cafes', name: 'Cafes', icon: <Coffee size={24} color="#fff" />, color: '#45B7D1' },
  { id: 'parks', name: 'Parks', icon: <TreePine size={24} color="#fff" />, color: '#96CEB4' },
  { id: 'shopping', name: 'Shopping', icon: <ShoppingBag size={24} color="#fff" />, color: '#FFEAA7' },
  { id: 'attractions', name: 'Attractions', icon: <Camera size={24} color="#fff" />, color: '#DDA0DD' },
  { id: 'gas', name: 'Gas Stations', icon: <Car size={24} color="#fff" />, color: '#FFB347' },
  { id: 'hospitals', name: 'Medical', icon: <Building size={24} color="#fff" />, color: '#FF7F7F' },
];

const CATEGORY_TO_GOOGLE_TYPE: Record<string, string> = {
  hotels: 'lodging',
  restaurants: 'restaurant',
  cafes: 'cafe',
  parks: 'park',
  shopping: 'shopping_mall',
  attractions: 'tourist_attraction',
  gas: 'gas_station',
  hospitals: 'hospital',
};

const CATEGORY_FALLBACK_IMAGE: Record<string, string> = {
  hotels: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
  restaurants: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400',
  cafes: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400',
  parks: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400',
  shopping: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400',
  attractions: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=400',
  gas: 'https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=400',
  hospitals: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400',
};

const DEFAULT_FALLBACK_IMAGE = CATEGORY_FALLBACK_IMAGE.restaurants;

const GENERIC_PLACE_TYPES = new Set(['point_of_interest', 'establishment', 'food', 'store']);

function formatPlaceType(types: string[]): string {
  const specific = types.find((t) => !GENERIC_PLACE_TYPES.has(t));
  if (!specific) return 'Place';
  return specific.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatPriceRange(priceLevel?: number): string | undefined {
  if (typeof priceLevel !== 'number' || priceLevel <= 0) return undefined;
  return '₦'.repeat(priceLevel);
}

function mapToPlace(result: NearbyPlaceResult, categoryId: string, userLocation: Location): Place {
  const photoUrl = result.photoReference ? GoogleMapsService.getPlacePhotoUrl(result.photoReference) : null;

  return {
    id: result.id,
    name: result.name,
    category: categoryId,
    rating: result.rating ?? 0,
    distance: GoogleMapsService.getDistanceLabel(userLocation, result.location),
    image: photoUrl ?? CATEGORY_FALLBACK_IMAGE[categoryId] ?? DEFAULT_FALLBACK_IMAGE,
    address: result.address,
    openHours: result.isOpenNow === undefined ? undefined : (result.isOpenNow ? 'Open now' : 'Closed now'),
    priceRange: formatPriceRange(result.priceLevel),
    description: formatPlaceType(result.types),
    location: result.location,
  };
}

export default function DiscoverScreen() {
  const { colors } = useTheme();
  const { userLocation, setDropoffLocation, setDropoffAddress, clearRoute } = useLocation();
  const { fetchWeather } = useWeather();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('restaurants');
  const [bookingPlace, setBookingPlace] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState<boolean>(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  React.useEffect(() => {
    if (userLocation) {
      void fetchWeather(userLocation);
    }
  }, [userLocation, fetchWeather]);

  React.useEffect(() => {
    if (!userLocation) return;
    let isCancelled = false;

    const loadPlaces = async () => {
      setIsLoadingPlaces(true);
      try {
        const googleType = CATEGORY_TO_GOOGLE_TYPE[selectedCategory] ?? 'restaurant';
        const results = await GoogleMapsService.getNearbyPlaces(googleType, userLocation);
        if (isCancelled) return;

        setPlaces(results.map((result) => mapToPlace(result, selectedCategory, userLocation)));
      } catch (error) {
        console.error('Failed to load nearby places:', error);
        if (!isCancelled) setPlaces([]);
      } finally {
        if (!isCancelled) setIsLoadingPlaces(false);
      }
    };

    void loadPlaces();
    return () => {
      isCancelled = true;
    };
  }, [userLocation, selectedCategory]);

  const filteredPlaces = places.filter(place => {
    const matchesSearch = place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         place.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleCategoryPress = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  const handlePlacePress = (place: Place) => {
    setBookingPlace(place.id);

    let destinationCoords: Location;
    if (place.location) {
      destinationCoords = place.location;
    } else {
      const baseLatitude = userLocation?.latitude ?? 9.0765;
      const baseLongitude = userLocation?.longitude ?? 7.3986;
      const numericId = parseInt(place.id, 10) || 1;
      const latitudeOffset = ((numericId % 5) - 2) * 0.012;
      const longitudeOffset = ((numericId % 7) - 3) * 0.01;

      destinationCoords = {
        latitude: baseLatitude + latitudeOffset,
        longitude: baseLongitude + longitudeOffset,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    clearRoute();
    setDropoffLocation(destinationCoords);
    setDropoffAddress(place.name);

    setTimeout(() => {
      setBookingPlace(null);
      router.push('/ride-confirmation');
    }, 250);
  };

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <Pressable
      style={[
        styles.categoryItem,
        {
          backgroundColor: selectedCategory === item.id ? item.color : colors.card,
          borderColor: colors.border,
        },
      ]}
      onPress={() => handleCategoryPress(item.id)}
    >
      <View style={[
        styles.categoryIcon,
        {
          backgroundColor: selectedCategory === item.id ? 'rgba(255,255,255,0.2)' : item.color,
        },
      ]}>
        {item.icon}
      </View>
      <Text style={[
        styles.categoryText,
        {
          color: selectedCategory === item.id ? '#fff' : colors.text,
        },
      ]}>
        {item.name}
      </Text>
    </Pressable>
  );

  const renderPlaceItem = ({ item }: { item: Place }) => (
    <Pressable
      style={[
        styles.placeCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
      onPress={() => handlePlacePress(item)}
    >
      <Image source={{ uri: item.image }} style={styles.placeImage} />
      <View style={styles.placeContent}>
        <View style={styles.placeHeader}>
          <Text style={[styles.placeName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.ratingContainer}>
            <Star size={14} color={colors.primary} fill={colors.primary} />
            <Text style={[styles.rating, { color: colors.text }]}>{item.rating}</Text>
          </View>
        </View>
        
        <View style={styles.placeInfo}>
          <MapPin size={12} color={colors.textSecondary} />
          <Text style={[styles.address, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
        
        <View style={styles.placeDetails}>
          <View style={styles.detailItem}>
            <Navigation size={12} color={colors.textSecondary} />
            <Text style={[styles.distance, { color: colors.textSecondary }]}>
              {item.distance}
            </Text>
          </View>
          
          {item.openHours && (
            <View style={styles.detailItem}>
              <Clock size={12} color={colors.textSecondary} />
              <Text style={[styles.openHours, { color: colors.textSecondary }]}>
                {item.openHours}
              </Text>
            </View>
          )}
          
          {item.priceRange && (
            <Text style={[styles.priceRange, { color: colors.primary }]}>
              {item.priceRange}
            </Text>
          )}
        </View>
        
        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.description}
        </Text>
        
        <Pressable
          style={[
            styles.bookRideButton,
            { 
              backgroundColor: bookingPlace === item.id ? colors.textSecondary : colors.primary,
              opacity: bookingPlace === item.id ? 0.7 : 1
            }
          ]}
          onPress={() => handlePlacePress(item)}
          disabled={bookingPlace === item.id}
        >
          <Text style={[styles.bookRideButtonText, { color: '#fff' }]}>
            {bookingPlace === item.id ? 'Preparing Route...' : 'Preview Route & Price'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );



  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Animated.ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Discover Places</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Find amazing places around you
          </Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <View style={[
            styles.searchContainer, 
            { 
              backgroundColor: colors.card, 
              borderColor: isSearchFocused ? colors.primary : colors.border,
              borderWidth: isSearchFocused ? 2 : 1,
            }
          ]}>
            <Search size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search places..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />
          </View>
        </View>

        {/* Weather Section */}
        <View style={styles.weatherWrapper}>
          <WeatherCard 
            title="Weather" 
            compact={true}
          />
        </View>

        {/* Categories Section */}
        <View style={styles.categoriesWrapper}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Categories</Text>
          <FlatList
            data={categories}
            renderItem={renderCategoryItem}
            keyExtractor={(item: Category) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
            scrollEnabled={true}
          />
        </View>

        {/* Places Section */}
        <View style={styles.placesSection}>
          <View style={styles.placesHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Places Near You</Text>
            <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
              {filteredPlaces.length} places
            </Text>
          </View>
          
          {isLoadingPlaces && places.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            filteredPlaces.map((item) => (
              <View key={item.id} style={styles.placeItemContainer}>
                {renderPlaceItem({ item })}
              </View>
            ))
          )}
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  searchWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  weatherWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  categoriesWrapper: {
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  categoriesList: {
    paddingHorizontal: 20,
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 80,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  placesSection: {
    flex: 1,
  },
  placesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  resultsCount: {
    fontSize: 14,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placesList: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  placeCard: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  placeImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  placeContent: {
    padding: 16,
  },
  placeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  placeName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  placeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  address: {
    fontSize: 14,
    marginLeft: 6,
    flex: 1,
  },
  placeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  distance: {
    fontSize: 12,
    marginLeft: 4,
  },
  openHours: {
    fontSize: 12,
    marginLeft: 4,
  },
  priceRange: {
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  bookRideButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  bookRideButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  placeItemContainer: {
    marginHorizontal: 20,
  },
});