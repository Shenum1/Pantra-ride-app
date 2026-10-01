import { Phone, Mail, HelpCircle, Bug, Inbox } from "lucide-react-native";
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
import { Stack, router } from "expo-router";
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

  const SUPPORT_PHONE = '+2349164329554';
  const SUPPORT_EMAIL = 'pantrateam@gmail.com';

  const handleCallSupport = () => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`);
  };

  const handleEmailSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
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
      const { ticketId } = await createTicket.mutateAsync({ subject: subject.trim(), category, message: message.trim() });
      setReportModalVisible(false);
      // Straight into the thread for this report, not just a one-time toast — this is
      // also where they'll see the support team's reply and can follow up themselves.
      router.push({ pathname: '/ticket-detail', params: { ticketId } });
    } catch (e) {
      Alert.alert("Could not submit report", (e as Error).message);
    }
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
          
          <View style={styles.supportOptionsContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Support</Text>

            <SupportOption
              icon={<Phone size={24} color={colors.primary} />}
              title="Call Support"
              description={SUPPORT_PHONE}
              onPress={handleCallSupport}
            />

            <SupportOption
              icon={<Mail size={24} color={colors.primary} />}
              title="Email Support"
              description={SUPPORT_EMAIL}
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
              icon={<Bug size={24} color={colors.text} />}
              title="Report an Issue"
              description="Let us know about technical problems"
              onPress={handleReportIssue}
            />

            <SupportOption
              icon={<Inbox size={24} color={colors.text} />}
              title="My Reports"
              description="Follow up on issues you've reported"
              onPress={() => router.push('/my-tickets')}
            />
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Support Hours</Text>
            <Text style={[styles.infoText, { color: colors.gray }]}>
              • Phone Support: 6 AM - 12 AM daily{'\n'}
              • Email Support: We respond within 24 hours
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