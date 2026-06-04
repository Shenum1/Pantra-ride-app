import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform as RNPlatform } from 'react-native';
import { Stack } from 'expo-router';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface DiagnosticCheck {
  name: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

export default function FirebaseDiagnostics() {
  const [checks, setChecks] = useState<DiagnosticCheck[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateCheck = (name: string, status: DiagnosticCheck['status'], message: string, details?: string) => {
    setChecks(prev => {
      const index = prev.findIndex(c => c.name === name);
      const newCheck = { name, status, message, details };
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = newCheck;
        return updated;
      }
      return [...prev, newCheck];
    });
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setChecks([]);

    updateCheck('Platform', 'pending', 'Checking platform...');
    await new Promise(resolve => setTimeout(resolve, 100));
    updateCheck('Platform', 'success', `Running on ${RNPlatform.OS}`, RNPlatform.Version?.toString());

    updateCheck('Supabase Config', 'pending', 'Checking Supabase configuration...');
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      updateCheck('Supabase Config', 'success', 'Configuration valid', `URL: ${supabaseUrl}`);
    } else {
      updateCheck('Supabase Config', 'error', 'Missing configuration',
        `URL: ${supabaseUrl ? '✓' : '✗'}\nAnon Key: ${supabaseKey ? '✓' : '✗'}`);
    }

    updateCheck('Auth Service', 'pending', 'Checking auth session...');
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const user = data.session?.user;
      updateCheck('Auth Service', 'success', 'Auth service reachable',
        user ? `Logged in as: ${user.email}` : 'No active session');
    } catch (error: any) {
      updateCheck('Auth Service', 'error', 'Auth service error', error.message);
    }

    updateCheck('Database Read', 'pending', 'Testing database read...');
    try {
      const { error } = await supabase.from('users').select('uid').limit(1);
      if (error) throw error;
      updateCheck('Database Read', 'success', 'Database read successful');
    } catch (error: any) {
      if (error.message?.includes('permission') || error.code === '42501') {
        updateCheck('Database Read', 'warning', 'Permission denied', 'RLS is active — sign in to read data.');
      } else {
        updateCheck('Database Read', 'error', 'Database read failed', error.message);
      }
    }

    updateCheck('Network', 'pending', 'Testing network connectivity...');
    try {
      const { error } = await supabase.from('rides').select('id').limit(1);
      if (error && !error.message?.includes('permission') && error.code !== '42501') throw error;
      updateCheck('Network', 'success', 'Network connected', 'Can reach Supabase.');
    } catch (error: any) {
      updateCheck('Network', 'error', 'Network error', error.message);
    }

    setIsRunning(false);
  };

  useEffect(() => {
    runDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusIcon = (status: DiagnosticCheck['status']) => {
    switch (status) {
      case 'success': return <CheckCircle size={20} color="#10b981" />;
      case 'error': return <XCircle size={20} color="#ef4444" />;
      case 'warning': return <AlertTriangle size={20} color="#f59e0b" />;
      default: return <RefreshCw size={20} color="#6b7280" />;
    }
  };

  const getStatusColor = (status: DiagnosticCheck['status']) => {
    switch (status) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Supabase Diagnostics', headerBackTitle: 'Back' }} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Supabase Connection Diagnostics</Text>
          <Text style={styles.subtitle}>Check your Supabase setup</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={runDiagnostics}
            disabled={isRunning}
          >
            <RefreshCw size={20} color="#fff" />
            <Text style={styles.buttonText}>{isRunning ? 'Running...' : 'Run Diagnostics'}</Text>
          </TouchableOpacity>
        </View>

        {checks.length > 0 && (
          <View style={styles.checksContainer}>
            {checks.map((check, index) => (
              <View key={index} style={styles.checkItem}>
                <View style={styles.checkHeader}>
                  <View style={styles.checkTitle}>
                    {getStatusIcon(check.status)}
                    <Text style={styles.checkName}>{check.name}</Text>
                  </View>
                  <Text style={[styles.checkStatus, { color: getStatusColor(check.status) }]}>
                    {check.status.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.checkMessage}>{check.message}</Text>
                {check.details && (
                  <View style={styles.checkDetails}>
                    <Text style={styles.checkDetailsText}>{check.details}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.infoBox}>
          <AlertTriangle size={20} color="#f59e0b" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Common Issues:</Text>
            <Text style={styles.infoText}>
              {'• No internet connection\n• Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY\n• Supabase project paused\n• RLS policies blocking access\n• Tables not created (run supabase-schema.sql)'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scrollView: { flex: 1 },
  content: { padding: 20 },
  header: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6b7280' },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  button: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  primaryButton: { backgroundColor: '#3b82f6' },
  buttonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  checksContainer: { gap: 12, marginBottom: 24 },
  checkItem: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  checkHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  checkTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  checkName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  checkStatus: { fontSize: 12, fontWeight: '700' },
  checkMessage: { fontSize: 14, color: '#4b5563', marginBottom: 4 },
  checkDetails: { marginTop: 8, padding: 12, backgroundColor: '#f3f4f6', borderRadius: 8 },
  checkDetailsText: { fontSize: 12, color: '#6b7280', fontFamily: 'monospace' },
  infoBox: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: '#fffbeb', borderRadius: 12, borderWidth: 1, borderColor: '#fde68a' },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: '600', color: '#92400e', marginBottom: 8 },
  infoText: { fontSize: 13, color: '#78350f', lineHeight: 20 },
});
