import { Eye, MapPin, MessageSquare, Share, Database } from "lucide-react-native";
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
  
  const [locationSharing, setLocationSharing] = useState(true);
  const [dataCollection, setDataCollection] = useState(false);
  const [personalizedAds, setPersonalizedAds] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState(false);
  
  const handleDataDownload = () => {
    Alert.alert(
      'Download Your Data',
      'We will prepare your data and send you a download link via email.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Request Download', onPress: () => Alert.alert('Request Sent', 'You will receive an email with your data download link within 24 hours.') },
      ]
    );
  };
  
  const handleDeleteData = () => {
    Alert.alert(
      'Delete Personal Data',
      'This will permanently delete all your personal data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Data Deleted', 'Your personal data has been permanently deleted.') },
      ]
    );
  };
  
  const handlePrivacyPolicy = () => {
    Alert.alert('Privacy Policy', 'View our complete privacy policy and terms of service.');
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
              description="Share your location for better ride matching"
              isEnabled={locationSharing}
              onToggle={setLocationSharing}
            />
            
            <PrivacyOption
              icon={<Database size={24} color={colors.primary} />}
              title="Data Collection"
              description="Allow collection of usage data for app improvement"
              isEnabled={dataCollection}
              onToggle={setDataCollection}
            />
            
            <PrivacyOption
              icon={<MessageSquare size={24} color={colors.primary} />}
              title="Personalized Ads"
              description="Show ads based on your preferences and activity"
              isEnabled={personalizedAds}
              onToggle={setPersonalizedAds}
            />
            
            <PrivacyOption
              icon={<Eye size={24} color={colors.primary} />}
              title="Profile Visibility"
              description="Make your profile visible to other users"
              isEnabled={profileVisibility}
              onToggle={setProfileVisibility}
            />
          </View>
          
          <View style={styles.dataManagementSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Management</Text>
            
            <Pressable 
              style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleDataDownload}
            >
              <Share size={20} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Download My Data</Text>
            </Pressable>
            
            <Pressable 
              style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handlePrivacyPolicy}
            >
              <Eye size={20} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Privacy Policy</Text>
            </Pressable>
            
            <Pressable 
              style={[styles.dangerButton, { backgroundColor: colors.danger + '10', borderColor: colors.danger }]}
              onPress={handleDeleteData}
            >
              <Database size={20} color={colors.danger} />
              <Text style={[styles.dangerButtonText, { color: colors.danger }]}>Delete All My Data</Text>
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
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  dangerButtonText: {
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