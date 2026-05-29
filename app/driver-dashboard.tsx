import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  SafeAreaView,
} from 'react-native';
import {
  Power,
  MapPin,
  Clock,
  DollarSign,
  Star,
  Car,

  Navigation,
  Phone,
  MessageCircle,
} from 'lucide-react-native';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { useDriverStore } from '@/hooks/useDriverStore';
import Colors from '@/constants/colors';
import { router } from 'expo-router';

export default function DriverDashboard() {
  const { driver, isLoading: authLoading, toggleOnlineStatus } = useDriverAuth();
  const {
    rideRequests,
    currentRide,
    isLoading,
    acceptRideRequest,
    declineRideRequest,
    updateRideStatus,
  } = useDriverStore();

  console.log('Driver dashboard render:', { driver, authLoading, isLoading });

  const handleAcceptRide = (rideId: string) => {
    Alert.alert(
      'Accept Ride',
      'Do you want to accept this ride request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () => acceptRideRequest(rideId),
        },
      ]
    );
  };

  const handleDeclineRide = (rideId: string) => {
    Alert.alert(
      'Decline Ride',
      'Are you sure you want to decline this ride?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => declineRideRequest(rideId),
        },
      ]
    );
  };

  const handleRideAction = (action: 'start' | 'complete' | 'cancel') => {
    switch (action) {
      case 'start':
        updateRideStatus('in_progress');
        break;
      case 'complete':
        Alert.alert(
          'Complete Ride',
          'Mark this ride as completed?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Complete',
              onPress: () => updateRideStatus('completed'),
            },
          ]
        );
        break;
      case 'cancel':
        Alert.alert(
          'Cancel Ride',
          'Are you sure you want to cancel this ride?',
          [
            { text: 'No', style: 'cancel' },
            {
              text: 'Yes, Cancel',
              style: 'destructive',
              onPress: () => updateRideStatus('cancelled'),
            },
          ]
        );
        break;
    }
  };

  if (authLoading || isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading driver dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!driver) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Driver profile not found</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/driver-login')}
          >
            <Text style={styles.buttonText}>Login as Driver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.profileSection}>
            <Image
              source={{ uri: driver.profileImage || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face' }}
              style={styles.profileImage}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.driverName}>{driver.name}</Text>
              <View style={styles.ratingContainer}>
                <Star size={16} color={Colors.light.primary} fill={Colors.light.primary} />
                <Text style={styles.rating}>{driver.rating.toFixed(1)}</Text>
                <Text style={styles.totalRides}>• {driver.totalRides} rides</Text>
              </View>
            </View>
          </View>

          {/* Online Status Toggle */}
          <TouchableOpacity
            style={[styles.onlineToggle, driver.isOnline ? styles.onlineActive : styles.onlineInactive]}
            onPress={toggleOnlineStatus}
          >
            <Power size={20} color={driver.isOnline ? Colors.light.white : Colors.light.gray} />
            <Text style={[styles.onlineText, driver.isOnline ? styles.onlineTextActive : styles.onlineTextInactive]}>
              {driver.isOnline ? 'Online' : 'Offline'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Earnings Summary */}
        <View style={styles.earningsCard}>
          <Text style={styles.cardTitle}>Today&apos;s Earnings</Text>
          <Text style={styles.earningsAmount}>${(driver.totalEarnings * 0.1).toFixed(2)}</Text>
          <View style={styles.earningsRow}>
            <View style={styles.earningsStat}>
              <Text style={styles.earningsLabel}>This Week</Text>
              <Text style={styles.earningsValue}>${(driver.totalEarnings * 0.3).toFixed(2)}</Text>
            </View>
            <View style={styles.earningsStat}>
              <Text style={styles.earningsLabel}>Total</Text>
              <Text style={styles.earningsValue}>${driver.totalEarnings.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Current Ride */}
        {currentRide && (
          <View style={styles.currentRideCard}>
            <Text style={styles.cardTitle}>Current Ride</Text>
            <View style={styles.rideInfo}>
              <View style={styles.passengerInfo}>
                {currentRide.passenger.photo && (
                  <Image
                    source={{ uri: currentRide.passenger.photo }}
                    style={styles.passengerImage}
                  />
                )}
                <View style={styles.passengerDetails}>
                  <Text style={styles.passengerName}>{currentRide.passenger.name}</Text>
                  <View style={styles.passengerRating}>
                    <Star size={14} color={Colors.light.primary} fill={Colors.light.primary} />
                    <Text style={styles.passengerRatingText}>{currentRide.passenger.rating}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.rideDetails}>
                <View style={styles.locationRow}>
                  <MapPin size={16} color={Colors.light.success} />
                  <Text style={styles.locationText}>{currentRide.pickupAddress}</Text>
                </View>
                <View style={styles.locationRow}>
                  <MapPin size={16} color={Colors.light.danger} />
                  <Text style={styles.locationText}>{currentRide.dropoffAddress}</Text>
                </View>
                <View style={styles.rideMetrics}>
                  <View style={styles.metric}>
                    <Clock size={14} color={Colors.light.gray} />
                    <Text style={styles.metricText}>{currentRide.duration} min</Text>
                  </View>
                  <View style={styles.metric}>
                    <DollarSign size={14} color={Colors.light.gray} />
                    <Text style={styles.metricText}>${currentRide.estimatedEarnings?.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.rideActions}>
              {currentRide.status === 'confirmed' && (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.startButton]}
                    onPress={() => handleRideAction('start')}
                  >
                    <Navigation size={16} color={Colors.light.white} />
                    <Text style={styles.actionButtonText}>Start Ride</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={() => handleRideAction('cancel')}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
              {currentRide.status === 'in_progress' && (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.completeButton]}
                    onPress={() => handleRideAction('complete')}
                  >
                    <Text style={styles.actionButtonText}>Complete Ride</Text>
                  </TouchableOpacity>
                  <View style={styles.contactButtons}>
                    <TouchableOpacity style={styles.contactButton}>
                      <Phone size={16} color={Colors.light.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.contactButton}>
                      <MessageCircle size={16} color={Colors.light.primary} />
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Ride Requests */}
        {driver.isOnline && rideRequests.length > 0 && (
          <View style={styles.requestsSection}>
            <Text style={styles.sectionTitle}>Ride Requests</Text>
            {rideRequests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={styles.passengerInfo}>
                    {request.passenger.photo && (
                      <Image
                        source={{ uri: request.passenger.photo }}
                        style={styles.passengerImage}
                      />
                    )}
                    <View style={styles.passengerDetails}>
                      <Text style={styles.passengerName}>{request.passenger.name}</Text>
                      <View style={styles.passengerRating}>
                        <Star size={14} color={Colors.light.primary} fill={Colors.light.primary} />
                        <Text style={styles.passengerRatingText}>{request.passenger.rating}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.distanceText}>{request.distanceToPickup.toFixed(1)} km away</Text>
                </View>

                <View style={styles.requestDetails}>
                  <View style={styles.locationRow}>
                    <MapPin size={16} color={Colors.light.success} />
                    <Text style={styles.locationText}>{request.pickupAddress}</Text>
                  </View>
                  <View style={styles.locationRow}>
                    <MapPin size={16} color={Colors.light.danger} />
                    <Text style={styles.locationText}>{request.dropoffAddress}</Text>
                  </View>
                  <View style={styles.rideMetrics}>
                    <View style={styles.metric}>
                      <Clock size={14} color={Colors.light.gray} />
                      <Text style={styles.metricText}>{request.duration} min</Text>
                    </View>
                    <View style={styles.metric}>
                      <DollarSign size={14} color={Colors.light.gray} />
                      <Text style={styles.metricText}>${request.estimatedEarnings.toFixed(2)}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Car size={14} color={Colors.light.gray} />
                      <Text style={styles.metricText}>{request.rideType}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.declineButton]}
                    onPress={() => handleDeclineRide(request.id!)}
                  >
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => handleAcceptRide(request.id!)}
                  >
                    <Text style={styles.actionButtonText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* No Requests Message */}
        {driver.isOnline && rideRequests.length === 0 && !currentRide && (
          <View style={styles.noRequestsCard}>
            <Car size={48} color={Colors.light.gray} />
            <Text style={styles.noRequestsTitle}>Looking for rides...</Text>
            <Text style={styles.noRequestsText}>
              You&apos;re online and ready to receive ride requests
            </Text>
          </View>
        )}

        {/* Offline Message */}
        {!driver.isOnline && (
          <View style={styles.offlineCard}>
            <Power size={48} color={Colors.light.gray} />
            <Text style={styles.offlineTitle}>You&apos;re Offline</Text>
            <Text style={styles.offlineText}>
              Go online to start receiving ride requests
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.gray,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.danger,
    marginBottom: 20,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
    marginLeft: 4,
  },
  totalRides: {
    fontSize: 14,
    color: Colors.light.gray,
    marginLeft: 4,
  },
  onlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  onlineActive: {
    backgroundColor: Colors.light.success,
    borderColor: Colors.light.success,
  },
  onlineInactive: {
    backgroundColor: Colors.light.white,
    borderColor: Colors.light.border,
  },
  onlineText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  onlineTextActive: {
    color: Colors.light.white,
  },
  onlineTextInactive: {
    color: Colors.light.gray,
  },
  earningsCard: {
    backgroundColor: Colors.light.white,
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  earningsAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.light.success,
    marginBottom: 16,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  earningsStat: {
    flex: 1,
  },
  earningsLabel: {
    fontSize: 14,
    color: Colors.light.gray,
    marginBottom: 4,
  },
  earningsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  currentRideCard: {
    backgroundColor: Colors.light.white,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  rideInfo: {
    marginBottom: 16,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  passengerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  passengerDetails: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  passengerRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passengerRatingText: {
    fontSize: 14,
    color: Colors.light.text,
    marginLeft: 4,
  },
  rideDetails: {
    marginTop: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: Colors.light.text,
    marginLeft: 8,
    flex: 1,
  },
  rideMetrics: {
    flexDirection: 'row',
    marginTop: 8,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metricText: {
    fontSize: 14,
    color: Colors.light.gray,
    marginLeft: 4,
  },
  rideActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  startButton: {
    backgroundColor: Colors.light.primary,
    marginRight: 8,
  },
  completeButton: {
    backgroundColor: Colors.light.success,
    marginRight: 8,
  },
  acceptButton: {
    backgroundColor: Colors.light.primary,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: Colors.light.white,
    borderWidth: 1,
    borderColor: Colors.light.danger,
    marginLeft: 8,
  },
  declineButton: {
    backgroundColor: Colors.light.white,
    borderWidth: 1,
    borderColor: Colors.light.gray,
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.white,
    marginLeft: 4,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.danger,
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.gray,
  },
  contactButtons: {
    flexDirection: 'row',
  },
  contactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  requestsSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 16,
  },
  requestCard: {
    backgroundColor: Colors.light.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  distanceText: {
    fontSize: 12,
    color: Colors.light.gray,
  },
  requestDetails: {
    marginBottom: 16,
  },
  requestActions: {
    flexDirection: 'row',
  },
  noRequestsCard: {
    backgroundColor: Colors.light.white,
    margin: 20,
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  noRequestsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  noRequestsText: {
    fontSize: 14,
    color: Colors.light.gray,
    textAlign: 'center',
  },
  offlineCard: {
    backgroundColor: Colors.light.white,
    margin: 20,
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  offlineTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  offlineText: {
    fontSize: 14,
    color: Colors.light.gray,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.white,
  },
});