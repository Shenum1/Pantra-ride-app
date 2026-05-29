import type { User, AdminDashboardStats, SupportTicket, MarketingCampaign, NotificationTemplate } from '@/types';

export const mockUsers: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    rating: 4.8,
    totalRides: 45,
    isActive: true,
    isVerified: true,
    registrationDate: new Date('2024-01-15'),
    lastRideDate: new Date('2024-09-15'),
    totalSpent: 1250.50,
    savedLocations: [],
    status: 'active',
    notes: 'Premium customer'
  },
  {
    id: '2',
    name: 'Sarah Wilson',
    email: 'sarah@example.com',
    phone: '+1234567891',
    photo: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
    rating: 4.9,
    totalRides: 78,
    isActive: true,
    isVerified: true,
    registrationDate: new Date('2023-12-10'),
    lastRideDate: new Date('2024-09-16'),
    totalSpent: 2100.75,
    savedLocations: [],
    status: 'active'
  },
  {
    id: '3',
    name: 'Mike Johnson',
    email: 'mike@example.com',
    phone: '+1234567892',
    rating: 3.2,
    totalRides: 12,
    isActive: false,
    isVerified: false,
    registrationDate: new Date('2024-08-20'),
    lastRideDate: new Date('2024-08-25'),
    totalSpent: 180.25,
    savedLocations: [],
    status: 'suspended',
    suspensionReason: 'Multiple complaints from drivers'
  }
];

export const mockDashboardStats: AdminDashboardStats = {
  totalUsers: 15420,
  totalDrivers: 2850,
  activeRides: 127,
  totalRevenue: 485750.50,
  dailyRides: 1250,
  userGrowth: 12.5,
  driverGrowth: 8.3,
  revenueGrowth: 15.7,
  averageRating: 4.6,
  supportTickets: 23
};

export const mockSupportTickets: SupportTicket[] = [
  {
    id: '1',
    userId: '1',
    type: 'payment',
    priority: 'high',
    status: 'open',
    subject: 'Payment not processed',
    description: 'My payment was charged but ride was cancelled',
    createdAt: new Date('2024-09-17'),
    updatedAt: new Date('2024-09-17')
  },
  {
    id: '2',
    userId: '2',
    driverId: 'driver1',
    rideId: 'ride123',
    type: 'ride_issue',
    priority: 'medium',
    status: 'in_progress',
    subject: 'Driver was rude',
    description: 'The driver was unprofessional and rude during the ride',
    assignedTo: 'support_agent_1',
    createdAt: new Date('2024-09-16'),
    updatedAt: new Date('2024-09-17')
  },
  {
    id: '3',
    userId: '3',
    type: 'technical',
    priority: 'low',
    status: 'resolved',
    subject: 'App crashes on startup',
    description: 'The app keeps crashing when I try to open it',
    assignedTo: 'tech_support_1',
    resolution: 'User updated to latest app version, issue resolved',
    createdAt: new Date('2024-09-15'),
    updatedAt: new Date('2024-09-16'),
    resolvedAt: new Date('2024-09-16')
  }
];

export const mockMarketingCampaigns: MarketingCampaign[] = [
  {
    id: '1',
    name: 'Welcome New Users',
    type: 'acquisition',
    status: 'active',
    targetAudience: {
      userType: 'new',
      rideCount: { min: 0, max: 3 }
    },
    content: {
      title: 'Welcome to RideApp!',
      description: 'Get 50% off your first 3 rides',
      ctaText: 'Claim Offer',
      ctaUrl: '/promotions'
    },
    metrics: {
      sent: 1250,
      opened: 875,
      clicked: 420,
      converted: 180
    },
    startDate: new Date('2024-09-01'),
    endDate: new Date('2024-09-30'),
    createdAt: new Date('2024-08-25')
  },
  {
    id: '2',
    name: 'Weekend Special',
    type: 'promotion',
    status: 'completed',
    targetAudience: {
      userType: 'active',
      rideCount: { min: 5, max: 100 }
    },
    content: {
      title: 'Weekend Rides 30% Off',
      description: 'Save big on weekend rides this month',
      ctaText: 'Book Now',
      ctaUrl: '/book-ride'
    },
    metrics: {
      sent: 8500,
      opened: 6200,
      clicked: 2100,
      converted: 850
    },
    startDate: new Date('2024-08-01'),
    endDate: new Date('2024-08-31'),
    createdAt: new Date('2024-07-25')
  }
];

export const mockNotificationTemplates: NotificationTemplate[] = [
  {
    id: '1',
    name: 'Ride Confirmed',
    type: 'push',
    title: 'Ride Confirmed!',
    content: 'Your ride with {{driverName}} is confirmed. ETA: {{eta}} minutes',
    variables: ['driverName', 'eta'],
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-09-01')
  },
  {
    id: '2',
    name: 'Payment Receipt',
    type: 'email',
    title: 'Payment Receipt - Ride {{rideId}}',
    content: 'Thank you for your payment of ${{amount}} for ride {{rideId}}',
    variables: ['rideId', 'amount'],
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-08-15')
  },
  {
    id: '3',
    name: 'Driver Arrival',
    type: 'sms',
    title: 'Driver Arriving',
    content: 'Your driver {{driverName}} is arriving in {{eta}} minutes',
    variables: ['driverName', 'eta'],
    isActive: true,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-09-10')
  }
];