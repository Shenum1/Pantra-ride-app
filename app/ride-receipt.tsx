import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Download, Receipt, Share2 } from 'lucide-react-native';
import { format } from 'date-fns';
import { useTheme } from '@/hooks/useThemeStore';
import { loadRideReceipt } from '@/lib/ride-receipt-service';
import {
  buildRideReceiptHtml,
  buildRideReceiptText,
  naira,
  receiptTotalRows,
  ReceiptPerspective,
  RideReceipt,
} from '@/lib/ride-receipt';
import { downloadReceiptHtml, ReceiptCopiedError, shareReceiptMessage } from '@/lib/transaction-receipt';

// Receipt for one ride: /ride-receipt?rideId=…&as=rider|driver. Opened from
// the rider's trip history (my-rides, expense-rides) and the driver's
// (driver-trip-history). Same Download/Share actions as wallet receipts.
export default function RideReceiptScreen() {
  const { colors } = useTheme();
  const { rideId, as } = useLocalSearchParams<{ rideId?: string; as?: string }>();
  const perspective: ReceiptPerspective = as === 'driver' ? 'driver' : 'rider';
  const [receipt, setReceipt] = useState<RideReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyAction, setBusyAction] = useState<'download' | 'share' | null>(null);

  const load = useCallback(async () => {
    if (!rideId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(false);
    try {
      setReceipt(await loadRideReceipt(rideId, perspective));
    } catch (error) {
      console.error('Ride receipt: load failed:', error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [rideId, perspective]);

  useEffect(() => {
    void load();
  }, [load]);

  const runReceiptAction = async (action: 'download' | 'share') => {
    if (!receipt || busyAction) return;
    setBusyAction(action);
    try {
      if (action === 'download') {
        await downloadReceiptHtml(buildRideReceiptHtml(receipt));
      } else {
        await shareReceiptMessage(buildRideReceiptText(receipt));
      }
    } catch (error) {
      if (error instanceof ReceiptCopiedError) {
        Alert.alert('Copied', error.message);
      } else if (!(error instanceof Error && /cancel|abort/i.test(error.message))) {
        // A user dismissing the share/print sheet isn't an error worth showing.
        console.error(`Ride receipt ${action} failed:`, error);
        Alert.alert('Something went wrong', `Couldn't ${action === 'download' ? 'create' : 'share'} the receipt. Please try again.`);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const header = (
    <Stack.Screen
      options={{
        title: 'Receipt',
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
      }}
    />
  );

  if (isLoading) {
    return (
      <>
        {header}
        <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  if (!receipt) {
    return (
      <>
        {header}
        <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            {loadError
              ? "Couldn't load this receipt. Check your connection and try again."
              : 'No receipt for this ride. Receipts are available for completed rides and cancellations that charged a fee.'}
          </Text>
          {loadError && (
            <TouchableOpacity onPress={load} style={[styles.retryButton, { borderColor: colors.border }]}>
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Try again</Text>
            </TouchableOpacity>
          )}
        </View>
      </>
    );
  }

  const totals = receiptTotalRows(receipt);

  return (
    <>
      {header}
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.lightGray }]}>
              <Receipt size={32} color={colors.primary} />
            </View>
            <Text style={[styles.typeLabel, { color: colors.textSecondary }]}>Pantra · {receipt.title}</Text>
            <Text style={[styles.amount, { color: colors.text }]}>{naira(receipt.total)}</Text>
            {!Number.isNaN(receipt.date.getTime()) && (
              <Text style={[styles.typeLabel, { color: colors.textSecondary }]}>
                {format(receipt.date, 'MMM dd, yyyy • hh:mm a')}
              </Text>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Ride Details</Text>
            {receipt.details.map(([label, value], i) => (
              <React.Fragment key={label}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Fare Breakdown</Text>
            {receipt.charges.map((charge) => (
              <View key={charge.label} style={styles.fareRow}>
                <View style={styles.fareLabelContainer}>
                  <Text style={[styles.fareLabel, { color: colors.textSecondary }]}>{charge.label}</Text>
                  {charge.note && <Text style={[styles.fareNote, { color: colors.textSecondary }]}>{charge.note}</Text>}
                </View>
                <Text style={[styles.fareValue, { color: colors.text }]}>{naira(charge.amount)}</Text>
              </View>
            ))}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            {totals.map(([label, value], i) => (
              <View key={label} style={styles.fareRow}>
                <Text style={[i === 0 ? styles.totalLabel : styles.fareLabel, { color: i === 0 ? colors.text : colors.textSecondary }]}>
                  {label}
                </Text>
                <Text style={[i === 0 ? styles.totalValue : styles.fareValue, { color: colors.text }]}>{value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }, busyAction === 'share' && { opacity: 0.5 }]}
              onPress={() => runReceiptAction('download')}
              disabled={busyAction !== null}
              testID="download-ride-receipt-button"
            >
              {busyAction === 'download' ? <ActivityIndicator size="small" color={colors.text} /> : <Download size={20} color={colors.text} />}
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Download PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }, busyAction === 'download' && { opacity: 0.5 }]}
              onPress={() => runReceiptAction('share')}
              disabled={busyAction !== null}
              testID="share-ride-receipt-button"
            >
              {busyAction === 'share' ? <ActivityIndicator size="small" color={colors.text} /> : <Share2 size={20} color={colors.text} />}
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Share</Text>
            </TouchableOpacity>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerCard: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  typeLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  amount: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailLabel: {
    fontSize: 14,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
    flex: 2,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  fareLabelContainer: {
    flex: 1,
  },
  fareLabel: {
    fontSize: 14,
  },
  fareNote: {
    fontSize: 12,
    marginTop: 2,
  },
  fareValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
});
