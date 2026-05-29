import { MessageCircle, Phone, Mail, FileText, HelpCircle, Bug } from "lucide-react-native";
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

interface SupportOptionProps {
  icon: React.ReactElement;
  title: string;
  description: string;
  onPress: () => void;
}

const SupportOption: React.FC<SupportOptionProps> = ({ icon, title, description, onPress }) => {
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
    </Pressable>
  );
};

export default function SupportScreen() {
  const { colors } = useTheme();
  
  const handleLiveChat = () => {
    Alert.alert(
      'Live Chat',
      'Choose how you want to connect with support:',
      [
        { 
          text: 'WhatsApp', 
          onPress: () => Linking.openURL('https://wa.me/18001234567?text=Hi, I need help with') 
        },
        { 
          text: 'Messenger', 
          onPress: () => Linking.openURL('https://m.me/rideapp') 
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };
  
  const handleCallSupport = () => {
    Alert.alert(
      'Call Support',
      'Select a support line:',
      [
        { text: 'Main Support: +1-800-123-4567', onPress: () => Linking.openURL('tel:+18001234567') },
        { text: 'Emergency Line: +1-800-911-RIDE', onPress: () => Linking.openURL('tel:+18009111743') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };
  
  const handleEmailSupport = () => {
    Alert.alert(
      'Email Support',
      'Choose your support category:',
      [
        { 
          text: 'General Support', 
          onPress: () => Linking.openURL('mailto:support@rideapp.com?subject=General Support Request') 
        },
        { 
          text: 'Billing Issues', 
          onPress: () => Linking.openURL('mailto:billing@rideapp.com?subject=Billing Support Request') 
        },
        { 
          text: 'Technical Support', 
          onPress: () => Linking.openURL('mailto:tech@rideapp.com?subject=Technical Support Request') 
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };
  
  const handleFAQ = () => {
    Alert.alert('FAQ', 'View frequently asked questions and answers.');
  };
  
  const handleReportIssue = () => {
    Alert.alert('Report Issue', 'Report a technical issue or bug.');
  };
  
  const handleHelpCenter = () => {
    Alert.alert('Help Center', 'Browse our comprehensive help documentation.');
  };
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Support',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }} 
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <ScrollView style={styles.content}>
          <View style={styles.headerSection}>
            <Text style={[styles.title, { color: colors.text }]}>How can we help?</Text>
            <Text style={[styles.subtitle, { color: colors.gray }]}>
              Get support when you need it most
            </Text>
          </View>
          
          <View style={[styles.emergencyCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
            <Text style={[styles.emergencyTitle, { color: colors.primary }]}>Need immediate help?</Text>
            <Text style={[styles.emergencyDescription, { color: colors.text }]}>
              For urgent safety issues during a ride, use the emergency button in the app or call 911.
            </Text>
          </View>
          
          <View style={styles.supportOptionsContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Support</Text>
            
            <SupportOption
              icon={<MessageCircle size={24} color={colors.primary} />}
              title="Live Chat"
              description="Chat with our support team in real-time"
              onPress={handleLiveChat}
            />
            
            <SupportOption
              icon={<Phone size={24} color={colors.primary} />}
              title="Call Support"
              description="Speak directly with a support representative"
              onPress={handleCallSupport}
            />
            
            <SupportOption
              icon={<Mail size={24} color={colors.primary} />}
              title="Email Support"
              description="Send us a detailed message about your issue"
              onPress={handleEmailSupport}
            />
          </View>
          
          <View style={styles.helpResourcesContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Help Resources</Text>
            
            <SupportOption
              icon={<HelpCircle size={24} color={colors.text} />}
              title="FAQ"
              description="Find answers to common questions"
              onPress={handleFAQ}
            />
            
            <SupportOption
              icon={<FileText size={24} color={colors.text} />}
              title="Help Center"
              description="Browse our complete help documentation"
              onPress={handleHelpCenter}
            />
            
            <SupportOption
              icon={<Bug size={24} color={colors.text} />}
              title="Report an Issue"
              description="Let us know about technical problems"
              onPress={handleReportIssue}
            />
          </View>
          
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Support Hours</Text>
            <Text style={[styles.infoText, { color: colors.gray }]}>
              • Live Chat: 24/7{'\n'}
              • Phone Support: 6 AM - 12 AM daily{'\n'}
              • Email Support: We respond within 24 hours{'\n'}
              • Emergency Support: Always available
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
  emergencyCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 24,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emergencyDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  supportOptionsContainer: {
    marginBottom: 32,
  },
  helpResourcesContainer: {
    marginBottom: 24,
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