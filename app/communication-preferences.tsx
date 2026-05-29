import { Bell, Mail, MessageSquare, Phone, Smartphone } from "lucide-react-native";
import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useThemeStore";
import { Stack } from "expo-router";

interface PreferenceOptionProps {
  icon: React.ReactElement;
  title: string;
  description: string;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const PreferenceOption: React.FC<PreferenceOptionProps> = ({ 
  icon, 
  title, 
  description, 
  isEnabled,
  onToggle
}) => {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.optionIcon}>
        <Text>{icon}</Text>
      </View>
      <View style={styles.optionContent}>
        <Text style={[styles.optionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.optionDescription, { color: colors.gray }]}>{description}</Text>
      </View>
      <Switch
        value={isEnabled}
        onValueChange={onToggle}
        trackColor={{ false: colors.lightGray, true: colors.primary }}
        thumbColor={colors.white}
      />
    </View>
  );
};

export default function CommunicationPreferencesScreen() {
  const { colors } = useTheme();
  
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [rideUpdates, setRideUpdates] = useState(true);
  const [promotionalEmails, setPromotionalEmails] = useState(false);
  const [driverMessages, setDriverMessages] = useState(true);
  const [safetyAlerts, setSafetyAlerts] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(true);
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Communication Preferences',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }} 
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <ScrollView style={styles.content}>
          <View style={styles.headerSection}>
            <Text style={[styles.title, { color: colors.text }]}>Communication Preferences</Text>
            <Text style={[styles.subtitle, { color: colors.gray }]}>
              Choose how you want to receive updates and notifications
            </Text>
          </View>
          
          <View style={styles.preferencesContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Notification Methods</Text>
            
            <PreferenceOption
              icon={<Bell size={24} color={colors.primary} />}
              title="Push Notifications"
              description="Receive notifications directly on your device"
              isEnabled={pushNotifications}
              onToggle={setPushNotifications}
            />
            
            <PreferenceOption
              icon={<Mail size={24} color={colors.primary} />}
              title="Email Notifications"
              description="Get updates and receipts via email"
              isEnabled={emailNotifications}
              onToggle={setEmailNotifications}
            />
            
            <PreferenceOption
              icon={<Smartphone size={24} color={colors.primary} />}
              title="SMS Notifications"
              description="Receive text messages for important updates"
              isEnabled={smsNotifications}
              onToggle={setSmsNotifications}
            />
          </View>
          
          <View style={styles.preferencesContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Ride Communications</Text>
            
            <PreferenceOption
              icon={<Bell size={24} color={colors.text} />}
              title="Ride Updates"
              description="Driver arrival, trip start, and completion notifications"
              isEnabled={rideUpdates}
              onToggle={setRideUpdates}
            />
            
            <PreferenceOption
              icon={<MessageSquare size={24} color={colors.text} />}
              title="Driver Messages"
              description="Allow drivers to send you messages about your ride"
              isEnabled={driverMessages}
              onToggle={setDriverMessages}
            />
            
            <PreferenceOption
              icon={<Phone size={24} color={colors.text} />}
              title="Safety Alerts"
              description="Emergency and safety-related notifications"
              isEnabled={safetyAlerts}
              onToggle={setSafetyAlerts}
            />
          </View>
          
          <View style={styles.preferencesContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Marketing & Updates</Text>
            
            <PreferenceOption
              icon={<Mail size={24} color={colors.text} />}
              title="Promotional Emails"
              description="Receive offers, discounts, and promotional content"
              isEnabled={promotionalEmails}
              onToggle={setPromotionalEmails}
            />
            
            <PreferenceOption
              icon={<Bell size={24} color={colors.text} />}
              title="Weekly Reports"
              description="Summary of your rides and spending"
              isEnabled={weeklyReports}
              onToggle={setWeeklyReports}
            />
          </View>
          
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Important Notes</Text>
            <Text style={[styles.infoText, { color: colors.gray }]}>
              • Safety alerts cannot be disabled for your protection{'\n'}
              • Some ride-related notifications are required for service{'\n'}
              • You can change these preferences at any time{'\n'}
              • Unsubscribing from emails may affect your account security
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
  preferencesContainer: {
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