import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Animated, 
  PanResponder, 
  Dimensions,
  TouchableOpacity 
} from 'react-native';
import { Car, Phone, X, ChevronDown, ChevronUp, Navigation2, Clock, MapPin, Star } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/hooks/useThemeStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_HEIGHT = SCREEN_HEIGHT * 0.12;
const MID_HEIGHT = SCREEN_HEIGHT * 0.35;
const MAX_HEIGHT = SCREEN_HEIGHT * 0.7;

interface Driver {
  id: string;
  name: string;
  rating: number;
  carModel: string;
  licensePlate: string;
  eta: number;
  phone: string;
  carType: string;
}

interface RideProgressBottomSheetProps {
  driver: Driver | null;
  rideStatus: string;
  timeRemaining: number;
  pickupAddress: string;
  dropoffAddress: string;
  distance: number | null;
  duration: number | null;
  onCall: () => void;
  onCancel: () => void;
  searchingMessage?: string;
}

const RideProgressBottomSheet: React.FC<RideProgressBottomSheetProps> = ({
  driver,
  rideStatus,
  timeRemaining,
  pickupAddress,
  dropoffAddress,
  distance,
  duration,
  onCall,
  onCancel,
  searchingMessage = "Looking for nearby drivers...",
}) => {
  const { colors } = useTheme();
  const [currentHeight, setCurrentHeight] = useState<number>(MID_HEIGHT);
  const pan = useRef(new Animated.Value(MID_HEIGHT)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const newHeight = currentHeight - gestureState.dy;
        if (newHeight >= MIN_HEIGHT && newHeight <= MAX_HEIGHT) {
          pan.setValue(newHeight);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const newHeight = currentHeight - gestureState.dy;
        let targetHeight = currentHeight;

        if (gestureState.dy < 0) {
          if (newHeight > MID_HEIGHT + 50) {
            targetHeight = MAX_HEIGHT;
          } else if (newHeight > MIN_HEIGHT + 50) {
            targetHeight = MID_HEIGHT;
          } else {
            targetHeight = MIN_HEIGHT;
          }
        } else {
          if (newHeight < MID_HEIGHT - 50) {
            targetHeight = MIN_HEIGHT;
          } else if (newHeight < MAX_HEIGHT - 50) {
            targetHeight = MID_HEIGHT;
          } else {
            targetHeight = MAX_HEIGHT;
          }
        }

        Animated.spring(pan, {
          toValue: targetHeight,
          useNativeDriver: false,
          friction: 8,
        }).start();
        setCurrentHeight(targetHeight);
      },
    })
  ).current;

  useEffect(() => {
    pan.setValue(MID_HEIGHT);
    setCurrentHeight(MID_HEIGHT);
  }, []);

  const toggleExpand = () => {
    const targetHeight = currentHeight === MAX_HEIGHT ? MID_HEIGHT : MAX_HEIGHT;
    Animated.spring(pan, {
      toValue: targetHeight,
      useNativeDriver: false,
      friction: 8,
    }).start();
    setCurrentHeight(targetHeight);
  };

  const formatTime = (minutes: number) => {
    const mins = Math.floor(minutes);
    const secs = Math.round((minutes - mins) * 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatDistance = (meters: number | null) => {
    if (!meters) return 'Calculating...';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Calculating...';
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  };

  const getStatusText = () => {
    if (rideStatus === 'pending') return searchingMessage;
    if (rideStatus === 'confirmed') return 'Driver is on the way';
    return 'On trip';
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height: pan,
          backgroundColor: colors.background,
        },
      ]}
    >
      <View {...panResponder.panHandlers} style={styles.handleContainer}>
        <View style={[styles.handle, { backgroundColor: colors.textSecondary }]} />
      </View>

      <Animated.ScrollView 
        style={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        scrollEnabled={currentHeight === MAX_HEIGHT}
      >
        <View style={[styles.statusHeader, { backgroundColor: colors.primaryLight }]}>
          <Navigation2 size={20} color={colors.primary} />
          <Text style={[styles.statusText, { color: colors.primary }]}>
            {getStatusText()}
          </Text>
          {timeRemaining > 0 && (
            <Text style={[styles.timeText, { color: colors.primary }]}>
              {formatTime(timeRemaining)}
            </Text>
          )}
        </View>

        {(distance || duration) && (
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <MapPin size={18} color={colors.textSecondary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Distance</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {formatDistance(distance)}
              </Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Clock size={18} color={colors.textSecondary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Duration</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {formatDuration(duration)}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.routeContainer}>
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: colors.primary }]} />
            <View style={styles.locationInfo}>
              <Text style={[styles.locationLabel, { color: colors.textSecondary }]}>Pickup</Text>
              <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={1}>
                {pickupAddress || 'Current Location'}
              </Text>
            </View>
          </View>

          <View style={[styles.routeLine, { backgroundColor: colors.border }]} />

          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: colors.secondary }]} />
            <View style={styles.locationInfo}>
              <Text style={[styles.locationLabel, { color: colors.textSecondary }]}>
                Dropoff
              </Text>
              <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={1}>
                {dropoffAddress || 'Destination'}
              </Text>
            </View>
          </View>
        </View>

        {driver && (
          <View style={styles.driverSection}>
            <View style={styles.driverHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Driver</Text>
            </View>

            <View style={styles.driverCard}>
              <View style={styles.driverInfo}>
                <View style={[styles.driverAvatar, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.driverInitials, { color: colors.primary }]}>
                    {driver.name.charAt(0)}
                  </Text>
                </View>

                <View style={styles.driverDetails}>
                  <Text style={[styles.driverName, { color: colors.text }]}>
                    {driver.name}
                  </Text>
                  <View style={styles.ratingContainer}>
                    <Star size={14} fill={colors.warning} color={colors.warning} style={styles.rating} />
                    <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                      {driver.rating.toFixed(1)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.carInfo}>
                <Car size={16} color={colors.textSecondary} />
                <View style={styles.carDetails}>
                  <Text style={[styles.carModel, { color: colors.text }]}>
                    {driver.carModel}
                  </Text>
                  <Text style={[styles.licensePlate, { color: colors.textSecondary }]}>
                    {driver.licensePlate}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.actionsContainer}>
              <Button
                title="Call Driver"
                variant="outline"
                onPress={onCall}
                style={styles.actionButton}
                icon={<Phone size={18} color={colors.primary} />}
              />
              <Button
                title="Cancel Ride"
                variant="danger"
                onPress={onCancel}
                style={styles.actionButton}
                icon={<X size={18} color={colors.white} />}
              />
            </View>
          </View>
        )}

        {!driver && rideStatus === 'pending' && (
          <View style={styles.searchingContainer}>
            <Text style={[styles.searchingText, { color: colors.text }]}>
              {searchingMessage}
            </Text>
            <Text style={[styles.searchingSubtext, { color: colors.textSecondary }]}>
              This usually takes less than a minute
            </Text>
            <Button
              title="Cancel Search"
              variant="outline"
              onPress={onCancel}
              style={styles.cancelSearchButton}
            />
          </View>
        )}

        <TouchableOpacity onPress={toggleExpand} style={styles.swipeHint}>
          {currentHeight === MAX_HEIGHT ? (
            <ChevronDown size={20} color={colors.textSecondary} />
          ) : (
            <ChevronUp size={20} color={colors.textSecondary} />
          )}
          <Text style={[styles.swipeHintText, { color: colors.textSecondary }]}>
            {currentHeight === MAX_HEIGHT ? 'Tap to collapse' : 'Tap to expand'}
          </Text>
        </TouchableOpacity>
      </Animated.ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    marginLeft: 12,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
  },
  infoDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginTop: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginTop: 2,
  },
  routeContainer: {
    marginBottom: 20,
    paddingVertical: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginBottom: 2,
  },
  locationText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  routeLine: {
    width: 2,
    height: 24,
    marginLeft: 5,
    marginVertical: 4,
  },
  driverSection: {
    marginBottom: 16,
  },
  driverHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  driverCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverInitials: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    marginRight: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  carInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  carDetails: {
    marginLeft: 12,
    flex: 1,
  },
  carModel: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  licensePlate: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  searchingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  searchingText: {
    fontSize: 16,
    fontWeight: '600' as const,
    textAlign: 'center',
    marginBottom: 8,
  },
  searchingSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  cancelSearchButton: {
    minWidth: 160,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 24,
  },
  swipeHintText: {
    fontSize: 12,
    marginLeft: 4,
  },
});

export default RideProgressBottomSheet;
