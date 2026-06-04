import { supabase } from './supabase';

export type UserRole = 'rider' | 'driver' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export class AuthService {
  static async signUpWithEmail(email: string, password: string, displayName: string, role: UserRole = 'rider') {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { displayName, role } },
    });

    if (error) throw new Error(error.message);

    const user = data.user;
    if (!user) throw new Error('Sign up failed — no user returned');

    try {
      await supabase.from('users').upsert({
        uid: user.id,
        email: user.email,
        displayName,
        role,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch {
      console.warn('Failed to write user profile row, account still created');
    }

    return user;
  }

  static async signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data.user;
  }

  static async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }

  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('uid', uid)
        .single();

      if (error || !data) return null;
      return data as UserProfile;
    } catch {
      return null;
    }
  }

  static async createMissingUserProfile(uid: string, email: string, displayName: string, role: UserRole) {
    const { error } = await supabase.from('users').upsert({
      uid,
      email,
      displayName,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);
  }

  static async updateUserProfile(uid: string, data: Partial<UserProfile>) {
    const { error } = await supabase
      .from('users')
      .update({ ...data, updatedAt: new Date().toISOString() })
      .eq('uid', uid);

    if (error) console.warn('Update user profile error:', error.message);
  }

  static async getCurrentSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  }

  static onAuthStateChanged(callback: (user: any | null) => void) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }
}
