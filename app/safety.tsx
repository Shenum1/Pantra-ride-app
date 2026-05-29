import { Shield, Phone, Users, AlertTriangle, MapPin, Clock } from "lucide-react-native";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useThemeStore";
import { Stack } from "expo-router";

interface SafetyFeatureProps {
  icon: React.ReactElement;
  title: string;
  description: string;
  isEnabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  onPress?: () => void;
}

const SafetyFeature: React.FC<SafetyFeatureProps> = ({ 
  icon, 
  title, 
  description, 
  isEnabled,
  onToggle,
  onPress 
}) => {
  const { colors } = useTheme();
  
  return (
    <Pressable 
      style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
    >
      <View style={styles.featureIcon}>
        <Text>{icon}</Text>
      </View>
      <View style={styles.featureContent}>
        <Text style={[styles.featureTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.featureDescription, { color: colors.gray }]}>{description}</Text>
      </View>
      {onToggle && (
        <Switch
          value={isEnabled}
          onValueChange={onToggle}
          trackColor={{ false: colors.lightGray, true: colors.primary }}
          thumbColor={colors.white}
        />
      )}
    </Pressable>
  );
};

export default function SafetyScreen() {
  const { colors } = useTheme();
  
  const [shareTrip, setShareTrip] = useState(true);
  const [emergencyContacts, setEmergencyContacts] = useState(true);
  const [rideCheck, setRideCheck] = useState(false);
  
  const handleEmergencyCall = () => {
    Alert.alert(
      'Emergency Call',
      'This will call emergency services immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call 911', style: 'destructive', onPress: () => Alert.alert('Calling 911...') },
      ]
    );
  };
  
  const handleTrustedContacts = () => {
    Alert.alert('Trusted Contacts', 'Manage your emergency contacts here.');
  };
  
  const handleSafetyCenter = () => {
    Alert.alert('Safety Center', 'Access safety resources and tips.');
  };
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Safety',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }} 
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <ScrollView style={styles.content}>
          <View style={styles.headerSection}>
            <Text style={[styles.title, { color: colors.text }]}>Your Safety Matters</Text>
            <Text style={[styles.subtitle, { color: colors.gray }]}>
              Tools and features to help keep you safe during your rides
            </Text>
          </View>
          
          <View style={[styles.emergencySection, { backgroundColor: colors.danger + '10', borderColor: colors.danger }]}>
            <Pressable 
              style={[styles.emergencyButton, { backgroundColor: colors.danger }]}
              onPress={handleEmergencyCall}
            >
              <Phone size={24} color={colors.white} />
              <Text style={[styles.emergencyText, { color: colors.white }]}>Emergency Call</Text>
            </Pressable>
            <Text style={[styles.emergencyDescription, { color: colors.danger }]}>
              Tap to call emergency services immediately
            </Text>
          </View>
          
          <View style={styles.featuresContainer}>
            <SafetyFeature
              icon={<MapPin size={24} color={colors.primary} />}
              title="Share Trip Details"
              description="Let trusted contacts follow your ride in real-time"
              isEnabled={shareTrip}
              onToggle={setShareTrip}
            />
            
            <SafetyFeature
              icon={<Users size={24} color={colors.primary} />}
              title="Emergency Contacts"
              description="Quick access to your trusted contacts"
              isEnabled={emergencyContacts}
              onToggle={setEmergencyContacts}
            />
            
            <SafetyFeature
              icon={<Clock size={24} color={colors.primary} />}
              title="RideCheck"
              description="Get notified if your trip is taking longer than expected"
              isEnabled={rideCheck}
              onToggle={setRideCheck}
            />
            
            <SafetyFeature
              icon={<Users size={24} color={colors.text} />}
              title="Trusted Contacts"
              description="Manage your emergency contact list"
              onPress={handleTrustedContacts}
            />
            
            <SafetyFeature
              icon={<Shield size={24} color={colors.text} />}
              title="Safety Center"
              description="Safety tips, resources, and community guidelines"
              onPress={handleSafetyCenter}
            />
          </View>
          
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <AlertTriangle size={20} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>Safety Tips</Text>
              <Text style={[styles.infoText, { color: colors.gray }]}>
                • Always verify your driver and vehicle{'\n'}
                • Share your trip with trusted contacts{'\n'}
                • Sit in the back seat{'\n'}
                • Trust your instincts
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  headerSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  emergencySection: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    marginBottom: 24,
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  emergencyText: {
    fontSize: 18,
    fontWeight: '700',
  },
  emergencyDescription: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  featuresContainer: {
    gap: 12,
    marginBottom: 24,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  featureIcon: {
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
});