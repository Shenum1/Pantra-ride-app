import { StatusBar } from "expo-status-bar";
import React, { useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Search, CloudSun } from "lucide-react-native";

import Map from "@/components/Map";
import { Skeleton, SkeletonCircle, ShimmerGroup } from "@/components/skeletons";
import { useTheme } from "@/hooks/useThemeStore";
import { useLocation } from "@/hooks/useLocationStore";
import { useWeather } from "@/hooks/useWeatherStore";
import { Location } from "@/types";
import { useRide } from "@/hooks/useRideStore";
import WeatherCard from "@/components/WeatherCard";


export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { isLoading, userLocation, locationError, retryLocation } = useLocation();
  const { currentRide, isHydratingRide } = useRide();
  const { fetchWeather } = useWeather();
  const [initialMapRegion, setInitialMapRegion] = useState<Location | undefined>(undefined);
  const [showWeather, setShowWeather] = useState(false);
  const insets = useSafeAreaInsets();
  const weatherAnimation = React.useRef(new Animated.Value(0)).current;
  const hasRedirectedToRide = useRef<boolean>(false);

  // If there's an active ride, redirect to ride progress
  React.useEffect(() => {
    if (isHydratingRide) {
      return;
    }

    if (currentRide && !hasRedirectedToRide.current) {
      hasRedirectedToRide.current = true;
      router.replace("/ride-progress");
      return;
    }

    if (!currentRide) {
      hasRedirectedToRide.current = false;
    }
  }, [currentRide, isHydratingRide, router]);

  // Set initial map region when user location is available
  React.useEffect(() => {
    if (userLocation) {
      setInitialMapRegion(userLocation);
      void fetchWeather(userLocation);
    }
  }, [userLocation, fetchWeather]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.fullMapContainer}>
          <Skeleton width="100%" height="100%" borderRadius={0} />
        </View>

        <ShimmerGroup>
          <View style={[styles.floatingControls, { paddingTop: insets.top + 20 }]}>
            <Skeleton style={styles.skeletonSearchButton} height={56} borderRadius={16} />
            <SkeletonCircle size={52} />
          </View>
        </ShimmerGroup>
      </View>
    );
  }

  const handleSearchPress = () => {
    router.push("/search");
  };

  const toggleWeather = () => {
    const toValue = showWeather ? 0 : 1;
    setShowWeather(!showWeather);
    
    Animated.spring(weatherAnimation, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      
      {/* Full Screen Map */}
      <View style={styles.fullMapContainer}>
        <Map
          initialRegion={initialMapRegion}
          showDrivers={false}
          fullScreen={true}
          preferStaticMap={false}
        />
      </View>
      

      
      {/* Floating Search Button */}
      <View style={[
        styles.floatingControls,
        {
          paddingTop: insets.top + 20,
        }
      ]}>
        <Pressable
          style={[
            styles.searchButton,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            }
          ]}
          onPress={handleSearchPress}
        >
          <Search size={20} color={colors.textSecondary} />
          <Text style={[styles.searchButtonText, { color: colors.textSecondary }]}>
            Where to?
          </Text>
        </Pressable>
        
        {/* Weather Toggle Button */}
        <Pressable
          style={[
            styles.weatherToggle,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            }
          ]}
          onPress={toggleWeather}
        >
          <CloudSun size={18} color={colors.primary} />
        </Pressable>
      </View>

      {!isLoading && !userLocation && locationError && (
        <View style={[styles.locationErrorBanner, { top: insets.top + 84, backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.locationErrorText, { color: colors.textSecondary }]}>{locationError}</Text>
          <Pressable onPress={() => void retryLocation()} testID="retry-location-button">
            <Text style={[styles.locationErrorRetry, { color: colors.primary }]}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Animated Weather Card */}
      <Animated.View 
        style={[
          styles.weatherContainer,
          {
            paddingTop: insets.top + 80,
            transform: [
              {
                translateY: weatherAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-200, 0],
                }),
              },
            ],
            opacity: weatherAnimation,
          }
        ]}
        pointerEvents={showWeather ? 'auto' : 'none'}
      >
        <WeatherCard 
          title="Current Weather" 
          compact={false}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  skeletonSearchButton: {
    flex: 1,
  },
  fullMapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  floatingControls: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 12,
    zIndex: 1000,
  },
  locationErrorBanner: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    zIndex: 999,
  },
  locationErrorText: {
    fontSize: 14,
    flex: 1,
  },
  locationErrorRetry: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 12,
  },
  searchButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  searchButtonText: {
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  weatherToggle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  weatherContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 900,
  },
});