import { Receipt, Download, DollarSign, FileText, Filter } from "lucide-react-native";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useThemeStore";
import { Stack } from "expo-router";

interface ExpenseRideProps {
  date: string;
  from: string;
  to: string;
  amount: number;
  category: string;
  receipt?: boolean;
}

const ExpenseRide: React.FC<ExpenseRideProps> = ({ date, from, to, amount, category, receipt = false }) => {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.rideCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.rideHeader}>
        <View style={styles.rideInfo}>
          <Text style={[styles.rideDate, { color: colors.gray }]}>{date}</Text>
          <Text style={[styles.rideRoute, { color: colors.text }]}>{from} → {to}</Text>
          <Text style={[styles.rideCategory, { color: colors.primary }]}>{category}</Text>
        </View>
        <View style={styles.rideAmount}>
          <Text style={[styles.amountText, { color: colors.text }]}>₦{amount.toFixed(2)}</Text>
          {receipt && (
            <Pressable style={styles.receiptButton}>
              <Receipt size={16} color={colors.primary} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

export default function ExpenseRidesScreen() {
  const { colors } = useTheme();
  
  const [expenseRides] = useState<ExpenseRideProps[]>([
    {
      date: 'Dec 15, 2024',
      from: 'Home',
      to: 'Office',
      amount: 25.50,
      category: 'Business',
      receipt: true,
    },
    {
      date: 'Dec 14, 2024',
      from: 'Airport',
      to: 'Hotel',
      amount: 45.00,
      category: 'Travel',
      receipt: true,
    },
    {
      date: 'Dec 13, 2024',
      from: 'Office',
      to: 'Client Meeting',
      amount: 18.75,
      category: 'Business',
      receipt: false,
    },
    {
      date: 'Dec 12, 2024',
      from: 'Home',
      to: 'Doctor',
      amount: 22.00,
      category: 'Medical',
      receipt: true,
    },
  ]);
  
  const totalExpenses = expenseRides.reduce((sum, ride) => sum + ride.amount, 0);
  
  const handleExportExpenses = () => {
    Alert.alert(
      'Export Expenses',
      'Choose export format for your expense report.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'PDF', onPress: () => Alert.alert('Exporting...', 'Your PDF report will be ready shortly.') },
        { text: 'CSV', onPress: () => Alert.alert('Exporting...', 'Your CSV file will be ready shortly.') },
      ]
    );
  };
  
  const handleFilterExpenses = () => {
    Alert.alert('Filter Expenses', 'Filter by date range, category, or amount.');
  };
  
  const handleAddExpense = () => {
    Alert.alert('Add Expense', 'Manually add a business expense.');
  };
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Expense Your Rides',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }} 
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <ScrollView style={styles.content}>
          <View style={styles.headerSection}>
            <Text style={[styles.title, { color: colors.text }]}>Business Expenses</Text>
            <Text style={[styles.subtitle, { color: colors.gray }]}>
              Track and manage your business ride expenses
            </Text>
          </View>
          
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.summaryHeader}>
              <DollarSign size={24} color={colors.primary} />
              <Text style={[styles.summaryTitle, { color: colors.text }]}>This Month</Text>
            </View>
            <Text style={[styles.summaryAmount, { color: colors.primary }]}>₦{totalExpenses.toFixed(2)}</Text>
            <Text style={[styles.summarySubtext, { color: colors.gray }]}>{expenseRides.length} business rides</Text>
          </View>
          
          <View style={styles.actionsContainer}>
            <Pressable 
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={handleExportExpenses}
            >
              <Download size={20} color={colors.white} />
              <Text style={[styles.actionButtonText, { color: colors.white }]}>Export Report</Text>
            </Pressable>
            
            <Pressable 
              style={[styles.secondaryButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleFilterExpenses}
            >
              <Filter size={20} color={colors.text} />
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Filter</Text>
            </Pressable>
          </View>
          
          <View style={styles.ridesContainer}>
            <View style={styles.ridesHeader}>
              <Text style={[styles.ridesTitle, { color: colors.text }]}>Recent Expenses</Text>
              <Pressable onPress={handleAddExpense}>
                <Text style={[styles.addExpenseText, { color: colors.primary }]}>+ Add</Text>
              </Pressable>
            </View>
            
            {expenseRides.map((ride, index) => (
              <ExpenseRide
                key={index}
                date={ride.date}
                from={ride.from}
                to={ride.to}
                amount={ride.amount}
                category={ride.category}
                receipt={ride.receipt}
              />
            ))}
          </View>
          
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <FileText size={20} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>Tax Deduction Tips</Text>
              <Text style={[styles.infoText, { color: colors.gray }]}>
                • Keep all receipts for business rides{'\n'}
                • Categorize expenses properly{'\n'}
                • Export monthly reports for your accountant{'\n'}
                • Track mileage for additional deductions
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
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
    alignItems: 'center',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  summarySubtext: {
    fontSize: 14,
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
  ridesContainer: {
    marginBottom: 24,
  },
  ridesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ridesTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  addExpenseText: {
    fontSize: 16,
    fontWeight: '600',
  },
  rideCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rideInfo: {
    flex: 1,
  },
  rideDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  rideRoute: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  rideCategory: {
    fontSize: 14,
    fontWeight: '500',
  },
  rideAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  receiptButton: {
    padding: 4,
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