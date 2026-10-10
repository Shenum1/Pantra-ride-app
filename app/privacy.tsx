import { Eye, MapPin, MessageSquare, Download, Trash2, ShieldCheck } from "lucide-react-native";
import React, { useState } from "react";
import {
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useThemeStore";
import { Stack, router } from "expo-router";
import { useRiderPreferences } from '@/hooks/useRiderPreferences';
import { usePrivacyStore } from '@/hooks/usePrivacyStore';
import { showAdPrivacyOptions } from '@/lib/ad-consent';
import { RiderPreferences } from '@/lib/rider-account-service';
import { AccountService } from '@/lib/account-service';

interface PrivacyOptionProps {
  icon: React.ReactElement;
  title: string;
  description: string;
  isEnabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  onPress?: () => void;
}

const PrivacyOption: React.FC<PrivacyOptionProps> = ({ 
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
      style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
    >
      <View style={styles.optionIcon}>
        <Text>{icon}</Text>
      </View>
      <View style={styles.optionContent}>
        <Text style={[styles.optionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.optionDescription, { color: colors.gray }]}>{description}</Text>
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

export default function PrivacyScreen() {
  const { colors } = useTheme();
  
  const { preferences, updatePreference } = useRiderPreferences();
  const adPrivacyOptionsRequired = usePrivacyStore((s) => s.consent.privacyOptionsRequired);
  const trackingDenied = usePrivacyStore(
    (s) => Platform.OS === 'ios' && (s.consent.tracking === 'denied' || s.consent.tracking === 'unavailable')
  );

  const setPreference = (key: keyof RiderPreferences, value: boolean) => {
    updatePreference(key, value).catch(() => {
      Alert.alert('Could not save', 'Your privacy setting was not saved. Please check your connection and try again.');
    });
  };

  const handleAdPrivacyOptions = () => {
    showAdPrivacyOptions().catch((error) => {
      console.error('Unable to open ad privacy options:', error);
      Alert.alert('Unavailable', 'Ad privacy options could not be opened right now. Please try again later.');
    });
  };

  const [downloading, setDownloading] = useState(false);

  const handleDownloadData = async () => {
    setDownloading(true);
    try {
      await AccountService.downloadMyData();
    } catch (error) {
      console.error('Could not download account data:', error);
      Alert.alert('Could not download your data', 'Please check your connection and try again in a moment.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteAccount = () => {
    router.push('/delete-account');
  };

  const handlePrivacyPolicy = () => {
    router.push('/privacy-policy');
  };
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Privacy',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }} 
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <ScrollView style={styles.content}>
          <View style={styles.headerSection}>
            <Text style={[styles.title, { color: colors.text }]}>Privacy Settings</Text>
            <Text style={[styles.subtitle, { color: colors.gray }]}>
              Control how your data is used and shared
            </Text>
          </View>
          
          <View style={styles.privacyOptionsContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Data & Privacy</Text>
            
            <PrivacyOption
              icon={<MapPin size={24} color={colors.primary} />}
              title="Location Sharing"
              description={
                preferences.locationSharing
                  ? "Use your current location for pickup, the map, weather and nearby places"
                  : "Off: Pantra won't read your location. Enter your pickup address manually"
              }
              isEnabled={preferences.locationSharing}
              onToggle={(value) => setPreference('locationSharing', value)}
            />

            <PrivacyOption
              icon={<MessageSquare size={24} color={colors.primary} />}
              title="Personalized Ads"
              description={
                preferences.personalizedAds && trackingDenied
                  ? "Tracking is off for Pantra in iOS Settings, so ads stay non-personalized"
                  : "Show ads based on your interests. When off, you still see ads, but they aren't personalized"
              }
              isEnabled={preferences.personalizedAds}
              onToggle={(value) => setPreference('personalizedAds', value)}
            />

            <PrivacyOption
              icon={<Eye size={24} color={colors.primary} />}
              title="Profile Photo Visibility"
              description="Let drivers on your trips see your profile photo"
              isEnabled={preferences.profileVisibility}
              onToggle={(value) => setPreference('profileVisibility', value)}
            />

            {adPrivacyOptionsRequired && (
              <PrivacyOption
                icon={<ShieldCheck size={24} color={colors.primary} />}
                title="Ad Privacy Options"
                description="Review or change the ad consent choices you made"
                onPress={handleAdPrivacyOptions}
              />
            )}
          </View>
          
          <View style={styles.dataManagementSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Management</Text>
            
            <Pressable 
              style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handlePrivacyPolicy}
            >
              <Eye size={20} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Privacy Policy</Text>
            </Pressable>
            
            <Pressable
              testID="privacy-download-data"
              style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleDownloadData}
              disabled={downloading}
            >
              <Download size={20} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>
                {downloading ? 'Preparing your data…' : 'Download My Data'}
              </Text>
            </Pressable>

            <Pressable
              testID="privacy-delete-account"
              style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleDeleteAccount}
            >
              <Trash2 size={20} color={colors.danger} />
              <Text style={[styles.actionButtonText, { color: colors.danger }]}>Delete My Account</Text>
            </Pressable>
          </View>
          
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Your Privacy Matters</Text>
            <Text style={[styles.infoText, { color: colors.gray }]}>
              We are committed to protecting your privacy and giving you control over your personal data. 
              You can adjust these settings at any time to match your preferences.
            </Text>
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
  privacyOptionsContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  optionIcon: {
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  dataManagementSection: {
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
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
