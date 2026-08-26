import { MessageCircle, Phone, Mail, FileText, HelpCircle, Bug } from "lucide-react-native";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  Linking,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useThemeStore";
import { Stack } from "expo-router";
import { trpc } from "@/lib/trpc";

const CATEGORIES = [
  { value: "ride_issue", label: "Ride" },
  { value: "payment_issue", label: "Payment" },
  { value: "account_issue", label: "Account" },
  { value: "safety", label: "Safety" },
  { value: "other", label: "Other" },
] as const;

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
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>("other");
  const [message, setMessage] = useState("");
  const createTicket = trpc.support.createTicket.useMutation();

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
    setSubject("");
    setCategory("other");
    setMessage("");
    setReportModalVisible(true);
  };

  const submitReport = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert("Missing details", "Please add a subject and a description.");
      return;
    }
    try {
      await createTicket.mutateAsync({ subject: subject.trim(), category, message: message.trim() });
      setReportModalVisible(false);
      Alert.alert("Report submitted", "Our support team will follow up shortly.");
    } catch (e) {
      Alert.alert("Could not submit report", (e as Error).message);
    }
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

      <Modal visible={reportModalVisible} transparent animationType="fade" onRequestClose={() => setReportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Report an Issue</Text>

            <Text style={[styles.modalLabel, { color: colors.gray }]}>Subject</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="Briefly describe the issue"
              placeholderTextColor={colors.gray}
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
            />

            <Text style={[styles.modalLabel, { color: colors.gray }]}>Category</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c.value}
                  onPress={() => setCategory(c.value)}
                  style={[
                    styles.categoryChip,
                    {
                      borderColor: category === c.value ? colors.primary : colors.border,
                      backgroundColor: category === c.value ? colors.primary + '15' : 'transparent',
                    },
                  ]}
                >
                  <Text style={{ color: category === c.value ? colors.primary : colors.text, fontSize: 13, fontWeight: '600' }}>
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.modalLabel, { color: colors.gray }]}>Description</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="What happened?"
              placeholderTextColor={colors.gray}
              multiline
              numberOfLines={4}
              style={[styles.modalInput, styles.modalTextArea, { color: colors.text, borderColor: colors.border }]}
            />

            <View style={styles.modalActions}>
              <Pressable style={[styles.modalButton, { borderColor: colors.border }]} onPress={() => setReportModalVisible(false)}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: colors.primary }]}
                onPress={submitReport}
                disabled={createTicket.isPending}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {createTicket.isPending ? 'Submitting…' : 'Submit'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalTextArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    borderWidth: 0,
  },
});