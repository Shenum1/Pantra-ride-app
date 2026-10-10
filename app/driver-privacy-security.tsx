import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Lock, ShieldCheck, ChevronRight, Download, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/hooks/useThemeStore';
import { AccountService } from '@/lib/account-service';

export default function DriverPrivacySecurityScreen() {
  const { colors } = useTheme();
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

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Privacy & Security',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <ScrollView style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Account Security</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Manage your password and review how your account data is protected.
          </Text>

          <Pressable
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push({ pathname: '/forgot-password', params: { from: 'driver' } } as any)}
          >
            <View style={styles.rowIcon}>
              <Lock size={20} color={colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Change Password</Text>
              <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
                Reset your password by email verification
              </Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            testID="driver-download-data"
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleDownloadData}
            disabled={downloading}
          >
            <View style={styles.rowIcon}>
              <Download size={20} color={colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                {downloading ? 'Preparing your data…' : 'Download My Data'}
              </Text>
              <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
                Get a copy of the information Pantra holds about you
              </Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            testID="driver-delete-account"
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/delete-account')}
          >
            <View style={styles.rowIcon}>
              <Trash2 size={20} color={colors.danger} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.danger }]}>Delete My Account</Text>
              <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
                Permanently erase your account and personal details
              </Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </Pressable>

          <View style={[styles.infoCard, { backgroundColor: colors.primaryLight }]}>
            <ShieldCheck size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              Your license, vehicle, and verification details are protected and can only be changed through the
              driver verification review process — not directly from this screen.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 21, marginBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  rowIcon: { marginRight: 16, width: 24, alignItems: 'center' },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  rowDescription: { fontSize: 13 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 12 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
