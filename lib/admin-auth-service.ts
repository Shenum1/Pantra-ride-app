import { supabase } from './supabase';
import { AuthService, UserProfile } from './auth-service';
import type { AdminUser } from '@/types';

function mapToAdminUser(profile: UserProfile): AdminUser {
  return {
    id: profile.uid,
    name: profile.displayName || profile.email.split('@')[0],
    email: profile.email,
    role: 'super_admin',
    department: 'management',
    permissions: [
      {
        id: 'full-access',
        name: 'Full Access',
        resource: 'users',
        actions: ['create', 'read', 'update', 'delete', 'approve'],
      },
    ],
    isActive: true,
    lastLogin: new Date(),
    createdAt: new Date(profile.createdAt),
  };
}

export class AdminAuthService {
  static async signInWithEmail(email: string, password: string): Promise<AdminUser> {
    const user = await AuthService.signInWithEmail(email, password);
    const profile = await AuthService.getUserProfile(user.id);

    if (!profile || profile.role !== 'admin') {
      await AuthService.signOut();
      throw new Error('This account does not have admin access.');
    }

    return mapToAdminUser(profile);
  }

  static async signOut(): Promise<void> {
    await AuthService.signOut();
  }

  static async getAdminByUserId(userId: string): Promise<AdminUser | null> {
    const profile = await AuthService.getUserProfile(userId);
    if (!profile || profile.role !== 'admin') return null;
    return mapToAdminUser(profile);
  }

  static onAuthStateChanged(callback: (admin: AdminUser | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          const admin = await this.getAdminByUserId(session.user.id);
          callback(admin);
        } else {
          callback(null);
        }
      } catch (error) {
        console.error('AdminAuthService: onAuthStateChange error', error);
        callback(null);
      }
    });
    return () => subscription.unsubscribe();
  }
}
