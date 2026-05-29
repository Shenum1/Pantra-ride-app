import { Driver, DriverProfile, RideRequestForDriver, DriverEarnings } from '@/types';

// Mock drivers data
export const mockDrivers: Driver[] = [
  {
    id: "d1",
    name: "John Doe",
    rating: 4.8,
    location: {
      latitude: 9.0765,
      longitude: 7.3986,
    },
    carType: "Standard",
    carModel: "Toyota Camry",
    licensePlate: "ABC-123",
    eta: 3,
    phone: "+1234567890",
  },
  {
    id: "d2",
    name: "Jane Smith",
    rating: 4.9,
    location: {
      latitude: 9.0775,
      longitude: 7.4005,
    },
    carType: "Premium",
    carModel: "Honda Accord",
    licensePlate: "XYZ-789",
    eta: 5,
    phone: "+1234567891",
  },
  {
    id: "d3",
    name: "Mike Johnson",
    rating: 4.7,
    location: {
      latitude: 9.0755,
      longitude: 7.3966,
    },
    carType: "Economy",
    carModel: "Kia Rio",
    licensePlate: "DEF-456",
    eta: 2,
    phone: "+1234567892",
  },
  {
    id: "d4",
    name: "Sarah Williams",
    rating: 4.6,
    location: {
      latitude: 9.0735,
      longitude: 7.3996,
    },
    carType: "Standard",
    carModel: "Hyundai Elantra",
    licensePlate: "GHI-789",
    eta: 4,
    phone: "+1234567893",
  },
];

export const mockDriverProfile: DriverProfile = {
  id: 'driver-1',
  name: 'John Smith',
  email: 'john.smith@email.com',
  phone: '+1234567890',
  photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  rating: 4.8,
  totalRides: 1247,
  isOnline: true,
  isVerified: true,
  vehicle: {
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    color: 'Silver',
    licensePlate: 'ABC-123',
    type: 'sedan',
  },
  documents: {
    driverLicense: {
      number: 'DL123456789',
      expiryDate: new Date('2026-12-31'),
      isVerified: true,
    },
    vehicleRegistration: {
      number: 'VR987654321',
      expiryDate: new Date('2025-06-30'),
      isVerified: true,
    },
    insurance: {
      provider: 'State Farm',
      policyNumber: 'SF123456789',
      expiryDate: new Date('2025-03-15'),
      isVerified: true,
    },
  },
  earnings: {
    today: 127.50,
    thisWeek: 892.30,
    thisMonth: 3456.78,
    total: 45678.90,
  },
  location: {
    latitude: 37.7749,
    longitude: -122.4194,
  },
  createdAt: new Date('2023-01-15'),
  lastActiveAt: new Date(),
};

export const mockRideRequests: RideRequestForDriver[] = [
  {
    id: 'ride-req-1',
    pickupLocation: {
      latitude: 37.7849,
      longitude: -122.4094,
    },
    dropoffLocation: {
      latitude: 37.7949,
      longitude: -122.3994,
    },
    pickupAddress: '123 Market St, San Francisco, CA',
    dropoffAddress: '456 Mission St, San Francisco, CA',
    rideType: 'standard',
    price: 15.50,
    distance: 2.3,
    duration: 12,
    status: 'pending',
    passenger: {
      id: 'user-1',
      name: 'Sarah Johnson',
      rating: 4.9,
      photo: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
    },
    estimatedEarnings: 12.40,
    distanceToPickup: 0.8,
    createdAt: new Date(),
  },
  {
    id: 'ride-req-2',
    pickupLocation: {
      latitude: 37.7649,
      longitude: -122.4294,
    },
    dropoffLocation: {
      latitude: 37.8049,
      longitude: -122.4094,
    },
    pickupAddress: '789 Union Square, San Francisco, CA',
    dropoffAddress: '321 Fisherman\'s Wharf, San Francisco, CA',
    rideType: 'premium',
    price: 28.75,
    distance: 4.1,
    duration: 18,
    status: 'pending',
    passenger: {
      id: 'user-2',
      name: 'Michael Chen',
      rating: 4.7,
      photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    },
    estimatedEarnings: 23.00,
    distanceToPickup: 1.2,
    createdAt: new Date(Date.now() - 2 * 60 * 1000),
  },
  {
    id: 'ride-req-3',
    pickupLocation: {
      latitude: 37.7549,
      longitude: -122.4394,
    },
    dropoffLocation: {
      latitude: 37.7149,
      longitude: -122.4794,
    },
    pickupAddress: '555 California St, San Francisco, CA',
    dropoffAddress: '777 Golden Gate Park, San Francisco, CA',
    rideType: 'shared',
    price: 8.25,
    distance: 3.7,
    duration: 22,
    status: 'pending',
    passenger: {
      id: 'user-3',
      name: 'Emily Rodriguez',
      rating: 4.6,
    },
    estimatedEarnings: 6.60,
    distanceToPickup: 2.1,
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
  },
];

export const mockDriverEarnings: DriverEarnings[] = [
  {
    id: 'earning-1',
    driverId: 'driver-1',
    rideId: 'ride-1',
    amount: 15.50,
    commission: 3.10,
    netAmount: 12.40,
    payoutStatus: 'completed',
    payoutDate: new Date(),
    createdAt: new Date(),
  },
  {
    id: 'earning-2',
    driverId: 'driver-1',
    rideId: 'ride-2',
    amount: 28.75,
    commission: 5.75,
    netAmount: 23.00,
    payoutStatus: 'completed',
    payoutDate: new Date(),
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
  },
  {
    id: 'earning-3',
    driverId: 'driver-1',
    rideId: 'ride-3',
    amount: 22.30,
    commission: 4.46,
    netAmount: 17.84,
    payoutStatus: 'pending',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
];

export const mockDriverStats = {
  totalRides: 1247,
  totalEarnings: 45678.90,
  averageRating: 4.8,
  acceptanceRate: 92,
  cancellationRate: 3,
  onlineHours: 156,
  completionRate: 97,
};