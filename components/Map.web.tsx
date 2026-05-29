import React, { useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Location } from "@/types";
import Colors from "@/constants/colors";
import { GoogleMapsService } from "@/lib/google-maps-service";

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
  routeStartLocation?: Location | null;
  routeEndLocation?: Location | null;
  customMarkers?: CustomMarker[];
}

function buildStaticMapUrl(center: Location): string | null {
  return GoogleMapsService.buildStaticMapUrl({ center, width: 900, height: 1200 });
}

const Map: React.FC<MapProps> = ({
  style,
  fullScreen = false,
  initialRegion,
}) => {
  const [staticMapFailed, setStaticMapFailed] = useState(false);
  const staticMapUrl = useMemo(() => {
    const center = initialRegion ?? { latitude: 9.0579, longitude: 7.4951 };
    return buildStaticMapUrl(center);
  }, [initialRegion]);

  return (
    <View style={[fullScreen ? styles.fullScreenContainer : styles.container, style]} testID="map-container">
      {!fullScreen && (
        <View style={styles.mapHeader}>
          <Text style={styles.mapTitle}>Google ride map</Text>
          <Text style={styles.mapSubtitle}>Powered by Google Maps</Text>
        </View>
      )}
      <View style={styles.webMapPlaceholder} testID="google-map">
        {staticMapUrl && !staticMapFailed ? (
          <Image
            source={{ uri: staticMapUrl }}
            style={styles.webMapImage}
            resizeMode="cover"
            onError={() => setStaticMapFailed(true)}
          />
        ) : (
          <View style={styles.fallbackMap}>
            <View style={styles.roadPrimary} />
            <View style={styles.roadSecondary} />
            <View style={styles.roadDiagonal} />
            <View style={[styles.mapPin, styles.pickupPin]} />
            <View style={[styles.mapPin, styles.dropoffPin]} />
            <Text style={styles.webMapText}>Map preview unavailable</Text>
            <Text style={styles.webMapSubtext}>
              Check the Google Maps API key, Static Maps API, billing, and key restrictions. You can still continue testing the ride flow.
            </Text>
          </View>
        )}
        <View style={styles.providerBadge}>
          <Text style={styles.providerBadgeText}>Google Maps</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.mapBackground,
    padding: 16,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: Colors.light.mapBackground,
  },
  mapHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  mapTitle: {
    fontSize: 20,
    fontWeight: "bold" as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  mapSubtitle: {
    fontSize: 12,
    color: Colors.light.gray,
    textAlign: "center",
  },
  webMapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.mapBackground,
    borderRadius: 16,
    padding: 24,
  },
  webMapImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  fallbackMap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#DCE8F3',
  },
  roadPrimary: {
    position: 'absolute',
    width: '130%',
    height: 46,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-8deg' }],
  },
  roadSecondary: {
    position: 'absolute',
    width: 58,
    height: '130%',
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    transform: [{ rotate: '16deg' }],
  },
  roadDiagonal: {
    position: 'absolute',
    width: '120%',
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.32)',
    transform: [{ rotate: '32deg' }],
  },
  mapPin: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  pickupPin: {
    left: '34%',
    top: '42%',
    backgroundColor: Colors.light.primary,
  },
  dropoffPin: {
    right: '31%',
    bottom: '36%',
    backgroundColor: Colors.light.secondary,
  },
  providerBadge: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  providerBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  webMapText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.light.text,
    textAlign: "center",
  },
  webMapSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.light.gray,
    textAlign: "center",
  },
});

export default Map;
