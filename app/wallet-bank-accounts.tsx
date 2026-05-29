import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Pressable,
  Animated,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Building2, CheckCircle, Clock, Plus, Trash2, Star } from 'lucide-react-native';
import { useTheme } from '@/hooks/useThemeStore';
import { useWallet, BankAccount } from '@/hooks/useWalletStore';

export default function ManageBankAccountsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const {
    bankAccounts,
    removeBankAccountAsync,
    setDefaultBankAccountAsync,
  } = useWallet();
  
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleDelete = (account: BankAccount) => {
    Alert.alert(
      'Remove Bank Account',
      `Are you sure you want to remove ${account.bankName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeBankAccountAsync(account.id);
              if (selectedId === account.id) {
                setSelectedId(null);
              }
              Alert.alert('Success', 'Bank account removed successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove bank account');
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (accountId: string) => {
    try {
      await setDefaultBankAccountAsync(accountId);
      Alert.alert('Success', 'Default bank account updated');
      setSelectedId(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to set default bank account');
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Manage Bank Accounts',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {bankAccounts.length === 0 ? (
            <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
              <View style={[styles.emptyIconContainer, { backgroundColor: colors.lightGray }]}>
                <Building2 size={48} color={colors.textSecondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Bank Accounts</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Add a bank account to withdraw money from your wallet
              </Text>
            </Animated.View>
          ) : (
            <Animated.View style={{ opacity: fadeAnim }}>
              {bankAccounts.map((account, index) => (
                <Pressable
                  key={account.id}
                  style={[
                    styles.accountCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    selectedId === account.id && { borderColor: colors.primary, borderWidth: 2 }
                  ]}
                  onPress={() => setSelectedId(selectedId === account.id ? null : account.id)}
                >
                  <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                    <Building2 size={24} color={colors.primary} />
                  </View>

                  <View style={styles.accountInfo}>
                    <View style={styles.accountHeader}>
                      <Text style={[styles.bankName, { color: colors.text }]}>{account.bankName}</Text>
                      {account.isDefault && (
                        <View style={[styles.defaultBadge, { backgroundColor: colors.primary + '20' }]}>
                          <Star size={12} color={colors.primary} fill={colors.primary} />
                          <Text style={[styles.defaultBadgeText, { color: colors.primary }]}>Default</Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.accountNumber, { color: colors.textSecondary }]}>
                      {account.accountNumber}
                    </Text>

                    <Text style={[styles.accountHolder, { color: colors.textSecondary }]}>
                      {account.accountHolderName}
                    </Text>

                    <View style={styles.statusRow}>
                      {account.isVerified ? (
                        <>
                          <CheckCircle size={14} color="#4CAF50" />
                          <Text style={[styles.statusText, { color: '#4CAF50' }]}>Verified</Text>
                        </>
                      ) : (
                        <>
                          <Clock size={14} color="#FF9800" />
                          <Text style={[styles.statusText, { color: '#FF9800' }]}>Pending Verification</Text>
                        </>
                      )}
                    </View>

                    {selectedId === account.id && (
                      <View style={styles.actionsRow}>
                        {!account.isDefault && (
                          <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: colors.primary }]}
                            onPress={() => handleSetDefault(account.id)}
                          >
                            <Star size={16} color="#FFF" />
                            <Text style={styles.actionButtonText}>Set as Default</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: '#F44336' }]}
                          onPress={() => handleDelete(account)}
                        >
                          <Trash2 size={16} color="#FFF" />
                          <Text style={styles.actionButtonText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
            </Animated.View>
          )}

          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.card, borderColor: colors.primary }]}
            onPress={() => router.push('/wallet-add-bank' as any)}
          >
            <Plus size={20} color={colors.primary} />
            <Text style={[styles.addButtonText, { color: colors.primary }]}>Add New Bank Account</Text>
          </TouchableOpacity>

          <View style={[styles.infoBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
            <Text style={[styles.infoText, { color: colors.text }]}>
              • Tap on a bank account to see actions{'\n'}
              • Set a default account for faster withdrawals{'\n'}
              • Accounts are verified within 1-2 business days{'\n'}
              • Only verified accounts can be used for withdrawals
            </Text>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  accountCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  bankName: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  accountNumber: {
    fontSize: 14,
    marginBottom: 4,
  },
  accountHolder: {
    fontSize: 13,
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginTop: 8,
    marginBottom: 20,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
