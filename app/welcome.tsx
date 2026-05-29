import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Calendar, Plane, Shield } from 'lucide-react-native';
import Button from '@/components/Button';
import Colors from '@/constants/colors';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=300&fit=crop' }}
            style={styles.image}
            resizeMode="cover"
          />
          <View style={styles.closeButton}>
            <Pressable
              onPress={() => router.replace('/role-selection')}
              style={styles.closeButtonInner}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.textContent}>
          <Text style={styles.title}>Scheduled Rides — made for your convenience</Text>
          <Text style={styles.description}>
            There&apos;s no need to stress whether you&apos;ll get a ride, plan ahead of time and enjoy the peace of mind.
          </Text>

          <View style={styles.features}>
            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Calendar size={24} color={Colors.light.primary} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Ideal for any occasion</Text>
                <Text style={styles.featureDescription}>
                  Dinner reservations? Doctor&apos;s appointment? Schedule a ride and arrive on time.
                </Text>
              </View>
            </View>

            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Plane size={24} color={Colors.light.primary} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Peace of mind anywhere you go</Text>
                <Text style={styles.featureDescription}>
                  Traveling abroad? Book rides up to 90 days in advance!
                </Text>
              </View>
            </View>

            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Shield size={24} color={Colors.light.primary} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Safe and reliable</Text>
                <Text style={styles.featureDescription}>
                  All drivers are verified and vehicles are regularly inspected for your safety.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title="Get Started"
          onPress={() => router.push('/role-selection')}
          style={styles.scheduleButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.white,
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    height: 300,
    width: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonInner: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: Colors.light.text,
    fontWeight: '300',
  },
  textContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 16,
    lineHeight: 36,
  },
  description: {
    fontSize: 16,
    color: Colors.light.gray,
    lineHeight: 24,
    marginBottom: 32,
  },
  features: {
    flex: 1,
  },
  feature: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: Colors.light.gray,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  scheduleButton: {
    width: '100%',
  },
});