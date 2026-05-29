import { Calendar, Plus, Settings, Send } from "lucide-react-native";
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

interface CalendarIntegration {
  id: string;
  name: string;
  type: string;
  isConnected: boolean;
  lastSync?: string;
}

interface CalendarItemProps {
  calendar: CalendarIntegration;
  onToggle: (id: string, enabled: boolean) => void;
  onSettings: (id: string) => void;
}

const CalendarItem: React.FC<CalendarItemProps> = ({ calendar, onToggle, onSettings }) => {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.calendarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.calendarHeader}>
        <View style={styles.calendarInfo}>
          <Text style={[styles.calendarName, { color: colors.text }]}>{calendar.name}</Text>
          <Text style={[styles.calendarType, { color: colors.gray }]}>{calendar.type}</Text>
          {calendar.lastSync && (
            <Text style={[styles.lastSync, { color: colors.gray }]}>
              Last synced: {calendar.lastSync}
            </Text>
          )}
        </View>
        <Switch
          value={calendar.isConnected}
          onValueChange={(enabled) => onToggle(calendar.id, enabled)}
          trackColor={{ false: colors.lightGray, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>
      {calendar.isConnected && (
        <Pressable 
          style={[styles.settingsButton, { backgroundColor: colors.background }]}
          onPress={() => onSettings(calendar.id)}
        >
          <Settings size={16} color={colors.text} />
          <Text style={[styles.settingsText, { color: colors.text }]}>Settings</Text>
        </Pressable>
      )}
    </View>
  );
};

export default function CalendarsScreen() {
  const { colors } = useTheme();
  
  const [calendars, setCalendars] = useState<CalendarIntegration[]>([
    {
      id: 'google',
      name: 'Google Calendar',
      type: 'Google Account',
      isConnected: true,
      lastSync: '2 hours ago',
    },
    {
      id: 'outlook',
      name: 'Outlook Calendar',
      type: 'Microsoft Account',
      isConnected: false,
    },
    {
      id: 'apple',
      name: 'Apple Calendar',
      type: 'iCloud Account',
      isConnected: false,
    },
  ]);
  
  const [autoScheduleRides, setAutoScheduleRides] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState(true);
  
  const handleToggleCalendar = (id: string, enabled: boolean) => {
    setCalendars(prev => 
      prev.map(cal => 
        cal.id === id 
          ? { ...cal, isConnected: enabled, lastSync: enabled ? 'Just now' : undefined }
          : cal
      )
    );
    
    const calendar = calendars.find(cal => cal.id === id);
    if (enabled) {
      Alert.alert('Calendar Connected', `${calendar?.name} has been connected successfully.`);
    } else {
      Alert.alert('Calendar Disconnected', `${calendar?.name} has been disconnected.`);
    }
  };
  
  const handleCalendarSettings = (id: string) => {
    const calendar = calendars.find(cal => cal.id === id);
    Alert.alert(`${calendar?.name} Settings`, 'Configure sync preferences and permissions.');
  };
  
  const handleAddCalendar = () => {
    Alert.alert('Add Calendar', 'Connect a new calendar service to sync your events.');
  };
  
  const handleSyncAll = () => {
    Alert.alert('Syncing...', 'Syncing all connected calendars. This may take a moment.');
    setCalendars(prev => 
      prev.map(cal => 
        cal.isConnected 
          ? { ...cal, lastSync: 'Just now' }
          : cal
      )
    );
  };
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Calendars',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }} 
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <ScrollView style={styles.content}>
          <View style={styles.headerSection}>
            <Text style={[styles.title, { color: colors.text }]}>Calendar Integration</Text>
            <Text style={[styles.subtitle, { color: colors.gray }]}>
              Connect your calendars to automatically schedule rides for your events
            </Text>
          </View>
          
          <View style={styles.actionsContainer}>
            <Pressable 
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={handleSyncAll}
            >
              <Send size={20} color={colors.white} />
              <Text style={[styles.actionButtonText, { color: colors.white }]}>Sync All</Text>
            </Pressable>
            
            <Pressable 
              style={[styles.secondaryButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleAddCalendar}
            >
              <Plus size={20} color={colors.text} />
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Add Calendar</Text>
            </Pressable>
          </View>
          
          <View style={styles.calendarsContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Connected Calendars</Text>
            
            {calendars.map((calendar) => (
              <CalendarItem
                key={calendar.id}
                calendar={calendar}
                onToggle={handleToggleCalendar}
                onSettings={handleCalendarSettings}
              />
            ))}
          </View>
          
          <View style={styles.smartFeaturesContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Smart Features</Text>
            
            <View style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.featureContent}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>Auto-Schedule Rides</Text>
                <Text style={[styles.featureDescription, { color: colors.gray }]}>
                  Automatically book rides based on your calendar events
                </Text>
              </View>
              <Switch
                value={autoScheduleRides}
                onValueChange={setAutoScheduleRides}
                trackColor={{ false: colors.lightGray, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
            
            <View style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.featureContent}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>Smart Suggestions</Text>
                <Text style={[styles.featureDescription, { color: colors.gray }]}>
                  Get ride suggestions based on your upcoming events
                </Text>
              </View>
              <Switch
                value={smartSuggestions}
                onValueChange={setSmartSuggestions}
                trackColor={{ false: colors.lightGray, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          </View>
          
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Calendar size={20} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>How It Works</Text>
              <Text style={[styles.infoText, { color: colors.gray }]}>
                • Connect your calendar accounts securely{'\n'}
                • We analyze your events for travel needs{'\n'}
                • Get ride suggestions before your meetings{'\n'}
                • Automatically book rides with your approval
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
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  calendarsContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  calendarCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarInfo: {
    flex: 1,
  },
  calendarName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  calendarType: {
    fontSize: 14,
    marginBottom: 2,
  },
  lastSync: {
    fontSize: 12,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
    gap: 6,
  },
  settingsText: {
    fontSize: 14,
    fontWeight: '500',
  },
  smartFeaturesContainer: {
    marginBottom: 24,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
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