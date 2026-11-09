import { Car, Navigation2 } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LatLng, MapMarker, Marker } from 'react-native-maps';

import { MAP_COLORS } from '@/constants/map-style';
import { bearingDegrees, distanceMeters } from '@/lib/map-geometry';

// Custom-view markers are drawn into a bitmap by the map SDK. While
// tracksViewChanges is on, Android redraws that bitmap every frame, which
// costs battery for the whole trip. Track only long enough for the view to
// draw, then freeze it. Changing `drawKey` re-enables tracking for one redraw.
const VIEW_SETTLE_MS = 500;

function useSettledViewTracking(drawKey: string): boolean {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => setTracksViewChanges(false), VIEW_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [drawKey]);

  return tracksViewChanges;
}

interface PointMarkerProps {
  kind: 'pickup' | 'dropoff';
  coordinate: LatLng;
  title?: string;
  description?: string;
  testID?: string;
}

// Pickup: brand-blue dot. Destination: dark square. Both sit centred on the
// exact coordinate (a pin's tip would hide the street the rider is on).
export const PointMarker = React.memo(function PointMarker({ kind, coordinate, title, description, testID }: PointMarkerProps) {
  const tracksViewChanges = useSettledViewTracking(kind);
  const isPickup = kind === 'pickup';

  return (
    <Marker
      coordinate={coordinate}
      title={title}
      description={description}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
      zIndex={isPickup ? 2 : 1}
      testID={testID}
    >
      <View style={[styles.halo, isPickup ? styles.pickupHalo : styles.dropoffHalo]}>
        <View style={isPickup ? styles.pickupDot : styles.dropoffSquare} />
      </View>
    </Marker>
  );
});

interface VehicleMarkerProps {
  coordinate: LatLng;
  title?: string;
  description?: string;
  testID?: string;
}

// Below this, GPS jitter would spin the arrow while the car stands still.
const BEARING_MIN_MOVE_METERS = 8;
const MOVE_ANIMATION_MS = 1000;

// The vehicle points along its direction of travel, worked out from its own
// position updates. Until it has moved far enough to know, it shows a car.
export const VehicleMarker = React.memo(function VehicleMarker({ coordinate, title, description, testID }: VehicleMarkerProps) {
  const markerRef = useRef<MapMarker | null>(null);
  const bearingOriginRef = useRef<LatLng>(coordinate);
  const [bearing, setBearing] = useState<number | null>(null);
  // Android glides the marker natively (animateMarkerToCoordinate). The
  // coordinate prop catches up once the glide ends, so a re-render mid-glide
  // can't snap the marker back. Elsewhere the prop is updated directly.
  const [renderedCoordinate, setRenderedCoordinate] = useState<LatLng>(coordinate);
  const tracksViewChanges = useSettledViewTracking(bearing === null ? 'car' : 'arrow');

  const { latitude, longitude } = coordinate;

  useEffect(() => {
    const next = { latitude, longitude };
    const origin = bearingOriginRef.current;
    if (distanceMeters(origin, next) >= BEARING_MIN_MOVE_METERS) {
      setBearing(bearingDegrees(origin, next));
      bearingOriginRef.current = next;
    }

    if (Platform.OS !== 'android' || !markerRef.current) {
      setRenderedCoordinate(next);
      return;
    }

    markerRef.current.animateMarkerToCoordinate(next, MOVE_ANIMATION_MS);
    const timer = setTimeout(() => setRenderedCoordinate(next), MOVE_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [latitude, longitude]);

  return (
    <Marker
      ref={markerRef}
      coordinate={renderedCoordinate}
      title={title}
      description={description}
      anchor={{ x: 0.5, y: 0.5 }}
      flat={bearing !== null}
      rotation={bearing ?? 0}
      tracksViewChanges={tracksViewChanges}
      zIndex={3}
      testID={testID}
    >
      <View style={styles.vehicle}>
        {bearing === null ? (
          <Car size={18} color={MAP_COLORS.labelHalo} strokeWidth={2.25} />
        ) : (
          <Navigation2 size={18} color={MAP_COLORS.labelHalo} fill={MAP_COLORS.labelHalo} strokeWidth={1.5} />
        )}
      </View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  // A soft dark ring keeps the white-bordered markers visible on white roads.
  halo: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.16)',
  },
  pickupHalo: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  dropoffHalo: {
    width: 24,
    height: 24,
    borderRadius: 5,
  },
  pickupDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: MAP_COLORS.labelHalo,
    backgroundColor: MAP_COLORS.pickup,
  },
  dropoffSquare: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 3,
    borderColor: MAP_COLORS.labelHalo,
    backgroundColor: MAP_COLORS.dropoff,
  },
  vehicle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: MAP_COLORS.labelHalo,
    backgroundColor: MAP_COLORS.vehicle,
  },
});
