import { supabase } from './supabase';
import { AuthService } from './auth-service';

export interface DriverSignupData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface DriverRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  rating: number | null;
  driverLicense: string;
  vehicle: {
    make: string;
    model: string;
    year: number;
    licensePlate: string;
    color: string;
  };
  isVerified: boolean;
  verificationStatus: string;
  isOnline: boolean;
  totalEarnings: number;
  totalRides: number;
  profileImage?: string;
  createdAt?: string;
}

function mapRowToDriver(row: any): DriverRow {
  return {
    id: row.id,
    name: row.name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    rating: row.rating ?? null,
    // licenseNumber is the structured column written by the driver-verification
    // wizard (backend/trpc/routes/driver-verification/submit-profile/route.ts) —
    // documents.driverLicense was the old free-text field written at signup, kept
    // only as a fallback for any pre-rebuild rows that never went through the wizard.
    driverLicense: row.licenseNumber ?? row.documents?.driverLicense ?? '',
    vehicle: {
      make: row.vehicle?.make ?? '',
      model: row.vehicle?.model ?? '',
      year: row.vehicle?.year ?? new Date().getFullYear(),
      licensePlate: row.vehicle?.licensePlate ?? '',
      color: row.vehicle?.color ?? '',
    },
    isVerified: row.isVerified ?? false,
    verificationStatus: row.verificationStatus ?? 'PENDING',
    isOnline: row.isOnline ?? false,
    totalEarnings: row.earnings?.total ?? 0,
    totalRides: row.totalRides ?? 0,
    profileImage: row.profileImage ?? undefined,
    createdAt: row.createdAt ?? undefined,
  };
}

export class DriverAuthService {
  // Creates the account only — full legal name, license, vehicle, and document
  // details are collected next in app/driver-verification/*, which submits them
  // through the driverProcedure tRPC routes (server-validated, service-role-written).
  // isVerified/verificationStatus are left at their DB defaults (false/'PENDING');
  // the "Allow driver insert" RLS policy in
  // database/schemas/supabase-schema-driver-verification-v2.sql rejects any insert
  // that tries to set them otherwise.
  static async signUpWithEmail(data: DriverSignupData): Promise<DriverRow> {
    const user = await AuthService.signUpWithEmail(data.email, data.password, data.name, 'driver');

    const { data: driverRow, error } = await supabase
      .from('drivers')
      .insert({
        userId: user.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        rating: null,
        isOnline: false,
        earnings: { today: 0, thisWeek: 0, thisMonth: 0, total: 0 },
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapRowToDriver(driverRow);
  }

  static async signInWithEmail(email: string, password: string): Promise<DriverRow> {
    const user = await AuthService.signInWithEmail(email, password);

    const { data: driverRow, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('userId', user.id)
      .single();

    if (error || !driverRow) throw new Error('No driver profile found for this account.');
    return mapRowToDriver(driverRow);
  }

  static async getDriverByUserId(userId: string): Promise<DriverRow | null> {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('userId', userId)
      .single();

    if (error || !data) return null;
    return mapRowToDriver(data);
  }

  static async signOut(): Promise<void> {
    await AuthService.signOut();
  }

  static onAuthStateChanged(callback: (driver: DriverRow | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          const driver = await this.getDriverByUserId(session.user.id);
          callback(driver);
        } else {
          callback(null);
        }
      } catch (error) {
        console.error('DriverAuthService: onAuthStateChange error', error);
        callback(null);
      }
    });
    return () => subscription.unsubscribe();
  }
}
