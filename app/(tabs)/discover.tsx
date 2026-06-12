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
  phone?: string;
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

const mockPlaces: Place[] = [
  {
    id: '1',
    name: 'Transcorp Hilton Hotel',
    category: 'hotels',
    rating: 4.8,
    distance: '3.2 km',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
    address: '1 Aguiyi Ironsi Street, Maitama, Abuja',
    phone: '+234 9 461 3000',
    openHours: '24/7',
    priceRange: '₦₦₦₦',
    description: 'Five-star luxury hotel with world-class amenities, spa, and stunning views of Abuja.',
  },
  {
    id: '2',
    name: 'Aso Rock Restaurant',
    category: 'restaurants',
    rating: 4.6,
    distance: '2.1 km',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400',
    address: 'Abuja International Conference Centre, Central Business District',
    phone: '+234 803 456 7890',
    openHours: '11:00 AM - 10:00 PM',
    priceRange: '₦₦₦',
    description: 'Fine dining restaurant offering Nigerian and international cuisine with great ambiance.',
  },
  {
    id: '3',
    name: 'Jabi Lake Mall',
    category: 'shopping',
    rating: 4.7,
    distance: '4.5 km',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400',
    address: 'Jabi District, Abuja',
    phone: '+234 700 JABI MALL',
    openHours: '10:00 AM - 10:00 PM',
    description: 'Premier shopping mall with cinema, restaurants, and international brands overlooking Jabi Lake.',
  },
  {
    id: '4',
    name: 'Millennium Park',
    category: 'parks',
    rating: 4.5,
    distance: '2.8 km',
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400',
    address: 'Maitama District, Abuja',
    openHours: '6:00 AM - 6:00 PM',
    description: 'Largest public park in Abuja, perfect for picnics, jogging, and family outings.',
  },
  {
    id: '5',
    name: 'National Mosque',
    category: 'attractions',
    rating: 4.6,
    distance: '3.5 km',
    image: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=400',
    address: 'Independence Avenue, Central District, Abuja',
    phone: '+234 9 234 5678',
    openHours: '8:00 AM - 6:00 PM',
    description: 'Iconic landmark with stunning Islamic architecture and golden dome.',
  },
  {
    id: '6',
    name: 'National Arts Theatre',
    category: 'attractions',
    rating: 4.4,
    distance: '3.8 km',
    image: 'https://images.unsplash.com/photo-1503095396549-807759245b35?w=400',
    address: 'Central Business District, Abuja',
    phone: '+234 9 876 5432',
    openHours: '9:00 AM - 6:00 PM',
    description: 'Cultural hub showcasing Nigerian arts, theater performances, and exhibitions.',
  },
  {
    id: '7',
    name: 'Ceddi Plaza',
    category: 'shopping',
    rating: 4.5,
    distance: '1.9 km',
    image: 'https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=400',
    address: 'Plot 264, Central Business District, Abuja',
    phone: '+234 9 413 5200',
    openHours: '9:00 AM - 9:00 PM',
    description: 'Popular shopping complex with retail stores, supermarket, and dining options.',
  },
  {
    id: '8',
    name: 'The French Bakery Cafe',
    category: 'cafes',
    rating: 4.3,
    distance: '1.5 km',
    image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400',
    address: 'Wuse 2, Abuja',
    phone: '+234 803 555 1234',
    openHours: '7:00 AM - 8:00 PM',
    priceRange: '₦₦',
    description: 'Cozy cafe with fresh pastries, coffee, and light meals in a pleasant atmosphere.',
  },
  {
    id: '9',
    name: 'Zuma Rock',
    category: 'attractions',
    rating: 4.9,
    distance: '45 km',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
    address: 'Niger State (Near Abuja)',
    openHours: '7:00 AM - 6:00 PM',
    description: 'Iconic monolithic rock formation, one of Nigeria\'s most recognizable landmarks.',
  },
  {
    id: '10',
    name: 'Nicon Luxury Hotel',
    category: 'hotels',
    rating: 4.7,
    distance: '2.5 km',
    image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400',
    address: 'Tafawa Balewa Way, Central Business District, Abuja',
    phone: '+234 9 523 2222',
    openHours: '24/7',
    priceRange: '₦₦₦₦',
    description: 'Premium hotel offering luxury accommodation with excellent facilities and service.',
  },
  {
    id: '11',
    name: 'Jevinik Restaurant',
    category: 'restaurants',
    rating: 4.5,
    distance: '2.7 km',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400',
    address: 'Plot 1181, Cadastral Zone, Wuse 2, Abuja',
    phone: '+234 807 777 7777',
    openHours: '10:00 AM - 11:00 PM',
    priceRange: '₦₦₦',
    description: 'Popular restaurant chain serving delicious Nigerian and continental dishes.',
  },
  {
    id: '12',
    name: 'Silverbird Cinemas Abuja',
    category: 'attractions',
    rating: 4.6,
    distance: '1.8 km',
    image: 'https://images.unsplash.com/photo-1489185078254-c3365d6e359f?w=400',
    address: 'Silverbird Entertainment Centre, Ahmadu Bello Way, Central Business District',
    phone: '+234 700 CINEMA',
    openHours: '10:00 AM - 11:00 PM',
    description: 'Modern cinema complex with latest movies, comfortable seating, and great sound system.',
  },
  {
    id: '13',
    name: 'National Hospital Abuja',
    category: 'hospitals',
    rating: 4.2,
    distance: '3.1 km',
    image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400',
    address: 'Plot 132, Central Business District, Abuja',
    phone: '+234 9 461 7201',
    openHours: '24/7',
    description: 'Leading tertiary healthcare facility providing comprehensive medical services.',
  },
  {
    id: '14',
    name: 'Total Filling Station',
    category: 'gas',
    rating: 4.3,
    distance: '1.1 km',
    image: 'https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=400',
    address: 'Ahmadu Bello Way, Central Business District, Abuja',
    phone: '+234 700 TOTAL',
    openHours: '24/7',
    description: 'Reliable fuel station with convenient store and car services.',
  },
  {
    id: '15',
    name: 'Medplus Pharmacy',
    category: 'hospitals',
    rating: 4.4,
    distance: '0.9 km',
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=400',
    address: 'Wuse 2, Abuja',
    phone: '+234 9 876 5000',
    openHours: '8:00 AM - 9:00 PM',
    description: 'Well-stocked pharmacy with quality medications and healthcare products.',
  },
  {
    id: '16',
    name: 'Usuma Dam',
    category: 'parks',
    rating: 4.3,
    distance: '25 km',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
    address: 'Ushafa Village, Bwari Area Council, Abuja',
    openHours: '8:00 AM - 5:00 PM',
    description: 'Scenic water reservoir perfect for picnics and nature photography.',
  },
  {
    id: '17',
    name: 'CityMall Abuja',
    category: 'shopping',
    rating: 4.4,
    distance: '3.3 km',
    image: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400',
    address: 'Plot 1516, Adetokunbo Ademola Crescent, Wuse 2, Abuja',
    phone: '+234 9 872 3456',
    openHours: '10:00 AM - 9:00 PM',
    description: 'Modern shopping mall with various retail outlets and food court.',
  },
  {
    id: '18',
    name: 'BlueCabin Restaurant',
    category: 'restaurants',
    rating: 4.4,
    distance: '2.3 km',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400',
    address: 'Garki District, Abuja',
    phone: '+234 803 999 8888',
    openHours: '11:00 AM - 10:00 PM',
    priceRange: '₦₦',
    description: 'Family-friendly restaurant with diverse menu and comfortable ambiance.',
  },
  {
    id: '19',
    name: 'National Arboretum',
    category: 'parks',
    rating: 4.6,
    distance: '8.5 km',
    image: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=400',
    address: 'Airport Road, Abuja',
    openHours: '7:00 AM - 6:00 PM',
    description: 'Beautiful botanical garden with diverse plant species and nature trails.',
  },
  {
    id: '20',
    name: 'Life Camp Shopping Complex',
    category: 'shopping',
    rating: 4.2,
    distance: '6.7 km',
    image: 'https://images.unsplash.com/photo-1567958451986-2de427a4a0be?w=400',
    address: 'Life Camp, Abuja',
    phone: '+234 803 111 2222',
    openHours: '9:00 AM - 8:00 PM',
    description: 'Local shopping complex with various stores, supermarket, and eateries.',
  },
];

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

        if (results.length > 0) {
          setPlaces(results.map((result) => mapToPlace(result, selectedCategory, userLocation)));
        } else {
          setPlaces(mockPlaces.filter((place) => place.category === selectedCategory));
        }
      } catch (error) {
        console.error('Failed to load nearby places:', error);
        if (!isCancelled) setPlaces(mockPlaces.filter((place) => place.category === selectedCategory));
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