export interface Location {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
}

export interface SavedLocation extends Location {
  id: string;
  name: string;
  address: string;
  type: 'home' | 'work' | 'favorite';
  icon?: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'cash' | 'wallet';
  name: string;
  isDefault: boolean;
  lastFour?: string;
  expiryDate?: string;
  icon: string;
}

export interface Promotion {
  id: string;
  code: string;
  description: string;
  discountPercentage: number;
  validUntil: Date;
  isUsed: boolean;
}

export interface Review {
  id: string;
  userId: string;
  driverId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}

export interface Driver {
  id: string;
  name: string;
  rating: number;
  location: Location;
  carType: string;
  carModel: string;
  licensePlate: string;
  eta: number;
  phone: string;
  reviews?: Review[];
}

export interface PassengerInfo {
  id: string;
  name: string;
  rating: number;
  photo?: string;
  phone?: string;
}

export interface RideType {
  id: string;
  name: string;
  description: string;
  icon: string;
  multiplier: number;
  eta: number;
}

export type RideTrackingStage = 'searching' | 'driver_assigned' | 'driver_arriving' | 'driver_arrived' | 'trip_in_progress';

export type RideCancellationReason = 'slow_pickup' | 'wrong_destination' | 'booked_by_mistake' | 'other';

export interface RideRequest {
  id?: string;
  pickupLocation: Location;
  dropoffLocation: Location;
  pickupAddress?: string;
  dropoffAddress?: string;
  rideType: string;
  price?: number;
  basePrice?: number;
  minPrice?: number;
  maxPrice?: number;
  fareAdjustmentPercent?: number;
  distance?: number;
  duration?: number;
  status?: 'pending' | 'confirmed' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  driver?: Driver;
  createdAt?: Date;
  scheduledFor?: Date;
  paymentMethod?: PaymentMethod;
  promoCode?: string;
  isShared?: boolean;
  sharedWith?: string[];
  trackingStage?: RideTrackingStage;
  statusText?: string;
  driverLocation?: Location;
  cancelReason?: RideCancellationReason;
  cancelReasonDetails?: string;
}

export interface EarnTask {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'social' | 'survey' | 'referral' | 'daily_check' | 'app_download';
  points: number;
  estimatedTime: number;
  icon: string;
  isCompleted: boolean;
  completedAt?: Date;
  expiresAt?: Date;
  url?: string;
  requirements?: string[];
  category: 'entertainment' | 'social' | 'engagement' | 'referral';
}

export interface UserEarnings {
  totalPoints: number;
  availablePoints: number;
  usedPoints: number;
  completedTasks: number;
  freeRidesEarned: number;
  currentStreak: number;
  lastActivity: Date;
}

export interface PointsTransaction {
  id: string;
  type: 'earned' | 'redeemed';
  points: number;
  description: string;
  taskId?: string;
  createdAt: Date;
}

export interface DriverProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  photo?: string;
  rating: number;
  totalRides: number;
  isOnline: boolean;
  isVerified: boolean;
  vehicle: {
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
    type: 'sedan' | 'suv' | 'hatchback' | 'luxury';
  };
  documents: {
    driverLicense: {
      number: string;
      expiryDate: Date;
      isVerified: boolean;
    };
    vehicleRegistration: {
      number: string;
      expiryDate: Date;
      isVerified: boolean;
    };
    insurance: {
      provider: string;
      policyNumber: string;
      expiryDate: Date;
      isVerified: boolean;
    };
  };
  earnings: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    total: number;
  };
  location?: Location;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface RideRequestForDriver extends RideRequest {
  passenger: PassengerInfo;
  estimatedEarnings: number;
  distanceToPickup: number;
}

export interface DriverEarnings {
  id: string;
  driverId: string;
  rideId: string;
  amount: number;
  commission: number;
  netAmount: number;
  payoutStatus: 'pending' | 'processing' | 'completed';
  payoutDate?: Date;
  createdAt: Date;
}

export interface DriverStats {
  totalRides: number;
  totalEarnings: number;
  averageRating: number;
  acceptanceRate: number;
  cancellationRate: number;
  onlineHours: number;
  completionRate: number;
  todayEarnings?: number;
  weekEarnings?: number;
  monthEarnings?: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'manager' | 'support' | 'marketing' | 'discovery';
  department: 'management' | 'customer_service' | 'driver_operations' | 'marketing' | 'discovery' | 'notifications';
  permissions: AdminPermission[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
}

export interface AdminPermission {
  id: string;
  name: string;
  resource: 'users' | 'drivers' | 'rides' | 'payments' | 'promotions' | 'notifications' | 'analytics' | 'settings';
  actions: ('create' | 'read' | 'update' | 'delete' | 'approve')[];
}

export interface User {
  id: string;
  uid?: string;
  name: string;
  email: string;
  phone: string;
  photo?: string;
  rating: number;
  totalRides: number;
  isActive: boolean;
  isVerified: boolean;
  registrationDate: Date;
  lastRideDate?: Date;
  totalSpent: number;
  preferredPaymentMethod?: PaymentMethod;
  savedLocations: SavedLocation[];
  status: 'active' | 'suspended' | 'banned';
  suspensionReason?: string;
  notes?: string;
}

export interface AdminDashboardStats {
  totalUsers: number;
  totalDrivers: number;
  activeRides: number;
  totalRevenue: number;
  dailyRides: number;
  userGrowth: number;
  driverGrowth: number;
  revenueGrowth: number;
  averageRating: number;
  supportTickets: number;
}

export interface RideAnalytics {
  id: string;
  date: Date;
  totalRides: number;
  completedRides: number;
  cancelledRides: number;
  totalRevenue: number;
  averageRideValue: number;
  peakHours: { hour: number; rides: number }[];
  popularRoutes: { from: string; to: string; count: number }[];
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'push' | 'email' | 'sms';
  title: string;
  content: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  type: 'promotion' | 'referral' | 'retention' | 'acquisition';
  status: 'draft' | 'active' | 'paused' | 'completed';
  targetAudience: {
    userType: 'all' | 'new' | 'active' | 'inactive';
    location?: string;
    rideCount?: { min: number; max: number };
  };
  content: {
    title: string;
    description: string;
    imageUrl?: string;
    ctaText: string;
    ctaUrl: string;
  };
  metrics: {
    sent: number;
    opened: number;
    clicked: number;
    converted: number;
  };
  startDate: Date;
  endDate: Date;
  createdAt: Date;
}

export interface SupportTicket {
  id: string;
  userId: string;
  driverId?: string;
  rideId?: string;
  type?: 'payment' | 'ride_issue' | 'technical' | 'account' | 'other';
  subject?: string;
  message?: string;
  description?: string;
  assignedTo?: string;
  resolution?: string;
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high';
  createdAt?: Date;
  updatedAt?: Date;
  resolvedAt?: Date;
}
