import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { User, Phone, Mail, Calendar, Car } from 'lucide-react-native';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { useTheme } from '@/hooks/useThemeStore';

function formatDate(value?: string): string {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not provided';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

interface InfoRowProps {
  icon: React.ReactElement;
  label: string;
  value: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
};

export default function DriverContactInfoScreen() {
  const { driver } = useDriverAuth();
  const { colors } = useTheme();

  const vehicleSummary = driver?.vehicle && (driver.vehicle.make || driver.vehicle.model)
    ? `${driver.vehicle.make} ${driver.vehicle.model}${driver.vehicle.licensePlate ? ` — ${driver.vehicle.licensePlate}` : ''}`.trim()
    : 'Not provided';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Contact & Information',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <ScrollView style={styles.content}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          <InfoRow icon={<User size={20} color={colors.primary} />} label="Full Name" value={driver?.name || 'Not provided'} />
          <InfoRow icon={<Phone size={20} color={colors.primary} />} label="Phone Number" value={driver?.phone || 'Not provided'} />
          <InfoRow icon={<Mail size={20} color={colors.primary} />} label="Email" value={driver?.email || 'Not provided'} />
          <InfoRow icon={<Calendar size={20} color={colors.primary} />} label="Driver Since" value={formatDate(driver?.createdAt)} />

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Vehicle</Text>
          <InfoRow icon={<Car size={20} color={colors.primary} />} label="Vehicle" value={vehicleSummary} />

          <Text style={[styles.note, { color: colors.textSecondary }]}>
            To change your phone, email, or vehicle details, contact support. License, vehicle, and verification
            fields are locked once submitted and can only be updated through the verification review process.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  rowIcon: { marginRight: 16, width: 24, alignItems: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 12, marginBottom: 4 },
  rowValue: { fontSize: 16, fontWeight: '600' },
  note: { fontSize: 13, lineHeight: 18, marginTop: 8, marginBottom: 24 },
});
