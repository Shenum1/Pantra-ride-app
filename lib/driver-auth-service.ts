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
  //
  // When the Supabase project requires email confirmation, signUp returns no session,
  // so the drivers insert below would run unauthenticated and be rejected by RLS
  // (auth.uid() = "userId"). In that case this returns null and the drivers row is
  // created once the email is confirmed (verifySignupCode, or first sign-in), from the
  // name/phone stashed in the auth user's metadata (see ensureDriverForAuthUser).
  static async signUpWithEmail(data: DriverSignupData): Promise<DriverRow | null> {
    const user = await AuthService.signUpWithEmail(data.email, data.password, data.name, 'driver', {
      phone: data.phone,
    });

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return null;

    return this.insertDriverRow(user.id, data.name, data.email, data.phone);
  }

  private static async insertDriverRow(
    userId: string,
    name: string,
    email: string,
    phone: string | null
  ): Promise<DriverRow> {
    const { data: driverRow, error } = await supabase
      .from('drivers')
      .insert({
        userId,
        name,
        email,
        phone,
        rating: null,
        isOnline: false,
        earnings: { today: 0, thisWeek: 0, thisMonth: 0, total: 0 },
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapRowToDriver(driverRow);
  }

  // Idempotent: returns the existing drivers row, or creates one for an account that
  // registered as a driver (auth metadata role === 'driver') but has none yet. That is
  // the normal state right after email confirmation, because signUp returned no session
  // and the RLS-guarded insert couldn't run until now. Accounts that didn't register as
  // drivers (riders, Google users) get null — nothing is created for them here.
  static async ensureDriverForAuthUser(user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, any> | null;
  }): Promise<DriverRow | null> {
    const existing = await this.getDriverByUserId(user.id);
    if (existing) return existing;
    if (user.user_metadata?.role !== 'driver') return null;

    const email = user.email ?? '';
    try {
      return await this.insertDriverRow(
        user.id,
        user.user_metadata?.displayName ?? email.split('@')[0],
        email,
        user.user_metadata?.phone ?? null
      );
    } catch (error) {
      // Lost a race with a concurrent ensure (the auth listener and the caller both
      // run right after sign-in) — the row exists now, so return it.
      const created = await this.getDriverByUserId(user.id);
      if (created) return created;
      throw error;
    }
  }

  static async signInWithEmail(email: string, password: string): Promise<DriverRow> {
    const user = await AuthService.signInWithEmail(email, password);
    const driver = await this.ensureDriverForAuthUser(user);
    if (!driver) throw new Error('No driver profile found for this account.');
    return driver;
  }

  // Completes email-confirmation signup with the code Supabase emailed. A successful
  // verifyOtp also signs the user in, so the drivers row can be created immediately.
  static async verifySignupCode(email: string, code: string): Promise<DriverRow> {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'signup',
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Verification succeeded but no account was returned.');

    const driver = await this.ensureDriverForAuthUser(data.user);
    if (!driver) throw new Error('Could not create your driver profile.');
    return driver;
  }

  // Creates a public.drivers row for a driver who signed up via Google (no
  // password-based signUpWithEmail call happened, so nothing has inserted this
  // row yet). Mirrors signUpWithEmail's insert exactly, minus the auth-account
  // creation step, which GoogleAuthService.signIn() already handled. phone is
  // left null — the driver-verification wizard collects and OTP-verifies it,
  // same as it does for an email-signup driver.
  static async createOrGetDriverForGoogleUser(userId: string, name: string, email: string): Promise<DriverRow> {
    const existing = await this.getDriverByUserId(userId);
    if (existing) return existing;

    await AuthService.updateUserProfile(userId, { role: 'driver' });

    const { data: driverRow, error } = await supabase
      .from('drivers')
      .insert({
        userId,
        name,
        email,
        phone: null,
        rating: null,
        isOnline: false,
        earnings: { today: 0, thisWeek: 0, thisMonth: 0, total: 0 },
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
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
          const driver = await this.ensureDriverForAuthUser(session.user);
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
