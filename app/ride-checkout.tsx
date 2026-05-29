import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ArrowRight, Minus, Plus, Wallet, Clock3, CreditCard, MapPin } from 'lucide-react-native';
import Button from '@/components/Button';
import Colors from '@/constants/colors';
import { useRide } from '@/hooks/useRideStore';
import { useLocation } from '@/hooks/useLocationStore';

const FARE_OPTIONS: number[] = [-10, 0, 10];

export default function RideCheckoutScreen() {
  const router = useRouter();
  const {
    requestRide,
    estimatedPrice,
    baseEstimatedPrice,
    minEstimatedPrice,
    maxEstimatedPrice,
    fareAdjustmentPercent,
    estimatedDistance,
    estimatedDuration,
    scheduledDate,
    selectedPaymentMethod,
    setFareAdjustment,
  } = useRide();
  const { pickupAddress, dropoffAddress, pickupLocation, dropoffLocation } = useLocation();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const priceNote = useMemo(() => {
    if (fareAdjustmentPercent > 0) {
      return `Fare increased by ${fareAdjustmentPercent}%`;
    }

    if (fareAdjustmentPercent < 0) {
      return `Fare reduced by ${Math.abs(fareAdjustmentPercent)}%`;
    }

    return 'Base fare selected';
  }, [fareAdjustmentPercent]);

  const handleBookRide = async () => {
    if (!pickupLocation || !dropoffLocation) {
      Alert.alert('Trip unavailable', 'Please select pickup and dropoff again.');
      return;
    }

    setIsSubmitting(true);

    try {
      const ride = await requestRide();
      if (ride) {
        router.push('/ride-progress');
      }
    } catch (error) {
      console.error('Error booking ride from checkout:', error);
      Alert.alert('Booking failed', 'We could not complete your booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Checkout', headerShadowVisible: false }} />
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <SafeAreaView edges={['top']}>
          <View style={styles.heroContent}>
            <Text style={styles.eyebrow}>Ride checkout</Text>
            <Text style={styles.heroTitle}>Review the route, tune the fare, then book.</Text>
            <Text style={styles.heroSubtitle}>Drivers will receive the live trip request with route distance, fare, and pickup details.</Text>
          </View>
        </SafeAreaView>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card} testID="checkout-route-card">
            <Text style={styles.cardTitle}>Trip</Text>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, styles.pickupDot]} />
              <View style={styles.routeTextWrap}>
                <Text style={styles.routeLabel}>Pickup</Text>
                <Text style={styles.routeValue}>{pickupAddress || 'Current location'}</Text>
              </View>
            </View>
            <View style={styles.routeDivider} />
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, styles.dropoffDot]} />
              <View style={styles.routeTextWrap}>
                <Text style={styles.routeLabel}>Dropoff</Text>
                <Text style={styles.routeValue}>{dropoffAddress || 'Destination'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard} testID="checkout-distance-card">
              <MapPin size={18} color={Colors.light.primary} />
              <Text style={styles.statLabel}>Distance</Text>
              <Text style={styles.statValue}>{estimatedDistance.toFixed(1)} km</Text>
            </View>
            <View style={styles.statCard} testID="checkout-duration-card">
              <Clock3 size={18} color={Colors.light.primary} />
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>{estimatedDuration} min</Text>
            </View>
          </View>

          <View style={styles.card} testID="fare-adjustment-card">
            <Text style={styles.cardTitle}>Adjust fare</Text>
            <Text style={styles.cardSubtitle}>You can reduce the quote by 10% or increase it by 10%.</Text>
            <View style={styles.priceShell}>
              <Text style={styles.priceCaption}>Current fare</Text>
              <Text style={styles.priceValue}>₦{estimatedPrice.toFixed(0)}</Text>
              <Text style={styles.priceMeta}>{priceNote}</Text>
              <Text style={styles.priceBounds}>Allowed range ₦{minEstimatedPrice.toFixed(0)} - ₦{maxEstimatedPrice.toFixed(0)}</Text>
            </View>

            <View style={styles.adjustmentGrid}>
              {FARE_OPTIONS.map((option) => {
                const isSelected = fareAdjustmentPercent === option;
                const prefix = option > 0 ? '+' : '';

                return (
                  <Pressable
                    key={option}
                    style={[styles.adjustmentChip, isSelected && styles.adjustmentChipActive]}
                    onPress={() => setFareAdjustment(option)}
                    testID={`fare-option-${option}`}
                  >
                    <Text style={[styles.adjustmentChipText, isSelected && styles.adjustmentChipTextActive]}>
                      {prefix}{option}%
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.inlineStepper}>
              <Pressable
                style={styles.stepperButton}
                onPress={() => setFareAdjustment(fareAdjustmentPercent - 10)}
                testID="fare-step-down"
              >
                <Minus size={18} color={Colors.light.text} />
              </Pressable>
              <View style={styles.stepperValueWrap}>
                <Text style={styles.stepperLabel}>Adjustment</Text>
                <Text style={styles.stepperValue}>{fareAdjustmentPercent > 0 ? '+' : ''}{fareAdjustmentPercent}%</Text>
              </View>
              <Pressable
                style={styles.stepperButton}
                onPress={() => setFareAdjustment(fareAdjustmentPercent + 10)}
                testID="fare-step-up"
              >
                <Plus size={18} color={Colors.light.text} />
              </Pressable>
            </View>

            <View style={styles.baseFareRow}>
              <Text style={styles.baseFareLabel}>Base fare</Text>
              <Text style={styles.baseFareValue}>₦{baseEstimatedPrice.toFixed(0)}</Text>
            </View>
          </View>

          <View style={styles.card} testID="payment-summary-card">
            <Text style={styles.cardTitle}>Payment</Text>
            <View style={styles.summaryItem}>
              <CreditCard size={18} color={Colors.light.primary} />
              <View style={styles.summaryTextWrap}>
                <Text style={styles.summaryLabel}>Method</Text>
                <Text style={styles.summaryValue}>{selectedPaymentMethod?.name || 'Cash'}</Text>
              </View>
            </View>
            <View style={styles.summaryItem}>
              <Wallet size={18} color={Colors.light.primary} />
              <View style={styles.summaryTextWrap}>
                <Text style={styles.summaryLabel}>Booking</Text>
                <Text style={styles.summaryValue}>{scheduledDate ? 'Scheduled ride' : 'Book now'}</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <View>
            <Text style={styles.footerLabel}>You will pay</Text>
            <Text style={styles.footerPrice}>₦{estimatedPrice.toFixed(0)}</Text>
          </View>
          <View style={styles.footerButtonWrap}>
            <Button
              title={scheduledDate ? 'Schedule ride now' : 'Book ride now'}
              onPress={handleBookRide}
              loading={isSubmitting}
              disabled={isSubmitting}
              icon={<ArrowRight size={18} color={Colors.light.white} />}
              testID="book-ride-now-button"
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F6FB',
  },
  hero: {
    backgroundColor: '#0D1B2A',
  },
  heroGlow: {
    position: 'absolute',
    top: 28,
    right: 24,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(59,130,246,0.24)',
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#9FB3C8',
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 34,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#C7D4E2',
    marginTop: 10,
    maxWidth: '92%',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: Colors.light.white,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    shadowColor: '#10233F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#122033',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#5D6B7D',
    lineHeight: 18,
    marginBottom: 16,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 5,
    marginRight: 12,
  },
  pickupDot: {
    backgroundColor: '#14B86A',
  },
  dropoffDot: {
    backgroundColor: '#F97316',
  },
  routeTextWrap: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#7D8A9A',
    marginBottom: 4,
  },
  routeValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#122033',
    lineHeight: 20,
  },
  routeDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#D9E1EB',
    marginLeft: 5,
    marginVertical: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#EDF4FF',
    borderRadius: 20,
    padding: 16,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 12,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  priceShell: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  priceCaption: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#94A3B8',
  },
  priceValue: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
  },
  priceMeta: {
    fontSize: 14,
    fontWeight: '600',
    color: '#60A5FA',
    marginTop: 6,
  },
  priceBounds: {
    fontSize: 13,
    color: '#CBD5E1',
    marginTop: 8,
  },
  adjustmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  adjustmentChip: {
    minWidth: 72,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#F3F6FB',
    borderWidth: 1,
    borderColor: '#D8E0EB',
    alignItems: 'center',
  },
  adjustmentChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  adjustmentChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#122033',
  },
  adjustmentChipTextActive: {
    color: '#FFFFFF',
  },
  inlineStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7F9FC',
    borderRadius: 18,
    padding: 10,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueWrap: {
    alignItems: 'center',
  },
  stepperLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  stepperValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#122033',
    marginTop: 4,
  },
  baseFareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  baseFareLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  baseFareValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#122033',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#122033',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#E3E9F1',
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  footerLabel: {
    fontSize: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  footerPrice: {
    fontSize: 26,
    fontWeight: '800',
    color: '#122033',
    marginTop: 2,
  },
  footerButtonWrap: {
    flex: 1,
    marginLeft: 16,
  },
});
