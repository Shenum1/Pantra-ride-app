import React, { useState } from 'react';
import { StyleSheet, View, Text, Switch, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Share2, Users, Clock, DollarSign, Shield } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useRide } from '@/hooks/useRideStore';
import Button from '@/components/Button';

export default function ShareRideScreen() {
  const router = useRouter();
  const { isSharedRide, toggleSharedRide } = useRide();
  const [isEnabled, setIsEnabled] = useState(isSharedRide);

  const handleToggleSwitch = () => {
    setIsEnabled(previousState => !previousState);
  };

  const handleSave = () => {
    toggleSharedRide(isEnabled);
    router.back();
  };

  const handleLearnMore = () => {
    Alert.alert(
      'Shared Rides',
      'Shared rides allow you to save money by sharing your ride with other passengers going in the same direction. You may have 1-2 additional stops, but you will save up to 20% on your fare.'
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ 
        title: 'Share Ride',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: Colors.light.background },
      }} />

      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Share2 size={24} color={Colors.light.primary} />
          </View>
          <Text style={styles.title}>Share your ride</Text>
          <Text style={styles.subtitle}>
            Save up to 20% by sharing your ride with others going in the same direction
          </Text>
        </View>

        <View style={styles.toggleContainer}>
          <Text style={styles.toggleLabel}>Enable shared rides</Text>
          <Switch
            trackColor={{ false: Colors.light.lightGray, true: Colors.light.primaryLight }}
            thumbColor={isEnabled ? Colors.light.primary : Colors.light.gray}
            ios_backgroundColor={Colors.light.lightGray}
            onValueChange={handleToggleSwitch}
            value={isEnabled}
            testID="share-ride-toggle"
          />
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Users size={20} color={Colors.light.text} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Share with others</Text>
              <Text style={styles.infoText}>
                You will be matched with 1-2 riders going in the same direction
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Clock size={20} color={Colors.light.text} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Slightly longer ride</Text>
              <Text style={styles.infoText}>
                Your trip may take 5-10 minutes longer with additional stops
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <DollarSign size={20} color={Colors.light.success} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Save money</Text>
              <Text style={styles.infoText}>
                Get up to 20% off your fare when you share
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Shield size={20} color={Colors.light.text} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Safety first</Text>
              <Text style={styles.infoText}>
                All riders are verified and trips are monitored
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.learnMoreContainer}>
          <Text style={styles.learnMoreText} onPress={handleLearnMore}>
            Learn more about shared rides
          </Text>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <Button 
          title="Save Preference" 
          onPress={handleSave} 
          testID="save-preference-button"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.gray,
    textAlign: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.light.white,
    marginHorizontal: 16,
    marginVertical: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  infoSection: {
    backgroundColor: Colors.light.white,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
    marginLeft: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: Colors.light.gray,
  },
  learnMoreContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  learnMoreText: {
    fontSize: 16,
    color: Colors.light.primary,
    textDecorationLine: 'underline',
  },
  buttonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
  },
});