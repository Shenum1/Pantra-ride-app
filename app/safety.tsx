import { Phone, AlertTriangle } from "lucide-react-native";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useThemeStore";
import { Stack } from "expo-router";

// Nigeria's national emergency number.
const EMERGENCY_NUMBER = '112';

export default function SafetyScreen() {
  const { colors } = useTheme();
  
  const handleEmergencyCall = () => {
    Alert.alert(
      'Emergency Call',
      `This will call ${EMERGENCY_NUMBER}, Nigeria's emergency number.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Call ${EMERGENCY_NUMBER}`,
          style: 'destructive',
          onPress: () => {
            Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch(() => {
              Alert.alert('Could not start the call', `Dial ${EMERGENCY_NUMBER} from your phone app.`);
            });
          },
        },
      ]
    );
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
              Tap to call emergency services (112)
            </Text>
          </View>
          
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <AlertTriangle size={20} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>Safety Tips</Text>
              <Text style={[styles.infoText, { color: colors.gray }]}>
                • Check the driver&apos;s name, car and plate match the app{'\n'}
                • Tell someone you trust where you are going{'\n'}
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
