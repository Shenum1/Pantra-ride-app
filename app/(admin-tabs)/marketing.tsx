import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, type DimensionValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, Target, Users, DollarSign } from 'lucide-react-native';

interface Campaign {
  id: string;
  name: string;
  type: 'promotion' | 'referral' | 'seasonal' | 'retention';
  status: 'active' | 'paused' | 'completed' | 'draft';
  budget: number;
  spent: number;
  impressions: number;
  conversions: number;
  startDate: string;
  endDate: string;
}

const CampaignCard: React.FC<{ campaign: Campaign }> = ({ campaign }) => {
  const conversionRate = ((campaign.conversions / campaign.impressions) * 100).toFixed(1);
  const budgetUsed = ((campaign.spent / campaign.budget) * 100).toFixed(0);
  const budgetWidth = `${Number(budgetUsed)}%` as unknown as DimensionValue;

  return (
    <View style={styles.campaignCard}>
      <View style={styles.campaignHeader}>
        <View style={styles.campaignInfo}>
          <Text style={styles.campaignName}>{campaign.name}</Text>
          <Text style={styles.campaignType}>{campaign.type}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(campaign.status) }]}>
          <Text style={styles.statusText}>{campaign.status}</Text>
        </View>
      </View>
      
      <View style={styles.campaignStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{campaign.impressions.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Impressions</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{campaign.conversions}</Text>
          <Text style={styles.statLabel}>Conversions</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{conversionRate}%</Text>
          <Text style={styles.statLabel}>CVR</Text>
        </View>
      </View>

      <View style={styles.budgetSection}>
        <View style={styles.budgetInfo}>
          <Text style={styles.budgetText}>
            ₦{campaign.spent.toLocaleString()} / ₦{campaign.budget.toLocaleString()}
          </Text>
          <Text style={styles.budgetPercentage}>{budgetUsed}% used</Text>
        </View>
        <View style={styles.budgetBar}>
          <View style={[styles.budgetProgress, { width: budgetWidth }]} />
        </View>
      </View>
    </View>
  );
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return '#10b981';
    case 'paused': return '#f59e0b';
    case 'completed': return '#6b7280';
    case 'draft': return '#3b82f6';
    default: return '#6b7280';
  }
};

export default function MarketingScreen() {
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const campaigns: Campaign[] = [
    {
      id: '1',
      name: 'Summer Ride Discount',
      type: 'seasonal',
      status: 'active',
      budget: 50000,
      spent: 32500,
      impressions: 125000,
      conversions: 3200,
      startDate: '2024-06-01',
      endDate: '2024-08-31',
    },
    {
      id: '2',
      name: 'Refer a Friend',
      type: 'referral',
      status: 'active',
      budget: 25000,
      spent: 18750,
      impressions: 85000,
      conversions: 1850,
      startDate: '2024-05-15',
      endDate: '2024-12-31',
    },
    {
      id: '3',
      name: 'New User Welcome',
      type: 'promotion',
      status: 'paused',
      budget: 15000,
      spent: 12000,
      impressions: 45000,
      conversions: 950,
      startDate: '2024-04-01',
      endDate: '2024-06-30',
    },
  ];

  const filters = [
    { key: 'all', label: 'All Campaigns' },
    { key: 'active', label: 'Active' },
    { key: 'paused', label: 'Paused' },
    { key: 'completed', label: 'Completed' },
  ];

  const marketingStats = [
    { label: 'Total Spend', value: '₦63.2K', icon: DollarSign, color: '#ef4444' },
    { label: 'Active Campaigns', value: '8', icon: Target, color: '#10b981' },
    { label: 'Total Reach', value: '2.1M', icon: Users, color: '#3b82f6' },
    { label: 'Avg CVR', value: '2.8%', icon: TrendingUp, color: '#f59e0b' },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={[styles.header, { paddingTop: insets.top + 32 }]}>
        <Text style={styles.headerTitle}>Marketing</Text>
        <Text style={styles.headerSubtitle}>Manage campaigns and promotions</Text>
      </LinearGradient>

      <View style={styles.statsContainer}>
        {marketingStats.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <View key={stat.label} style={styles.statCard}>
              <IconComponent size={20} color={stat.color} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          );
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterChip,
              selectedFilter === filter.key && styles.filterChipActive
            ]}
            onPress={() => setSelectedFilter(filter.key)}
          >
            <Text style={[
              styles.filterChipText,
              selectedFilter === filter.key && styles.filterChipTextActive
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.campaignsList}>
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </View>

        <TouchableOpacity style={styles.createButton}>
          <Text style={styles.createButtonText}>Create New Campaign</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  filtersContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  filterChipText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  campaignsList: {
    paddingBottom: 24,
  },
  campaignCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  campaignInfo: {
    flex: 1,
  },
  campaignName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  campaignType: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
  },
  campaignStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  budgetSection: {
    marginTop: 8,
  },
  budgetInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  budgetPercentage: {
    fontSize: 12,
    color: '#6b7280',
  },
  budgetBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  budgetProgress: {
    height: '100%',
    backgroundColor: '#667eea',
  },
  createButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});