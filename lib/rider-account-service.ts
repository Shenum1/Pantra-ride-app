import { supabase } from '@/lib/supabase';

export interface RiderPreferences {
  locationSharing: boolean;
  dataCollection: boolean;
  personalizedAds: boolean;
  profileVisibility: boolean;
  twoFactorRequested: boolean;
  biometricLogin: boolean;
  loginAlerts: boolean;
  shareTrip: boolean;
  emergencyContactsEnabled: boolean;
  rideCheck: boolean;
}

export interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  phone?: string;
}

export const DEFAULT_RIDER_PREFERENCES: RiderPreferences = {
  locationSharing: false, dataCollection: false, personalizedAds: false,
  profileVisibility: false, twoFactorRequested: false, biometricLogin: false,
  loginAlerts: false, shareTrip: false, emergencyContactsEnabled: false, rideCheck: false,
};

export class RiderAccountService {
  static async getPreferences(userId: string): Promise<RiderPreferences> {
    const { data, error } = await supabase.from('rider_preferences').select('*').eq('userId', userId).maybeSingle();
    if (error) throw new Error(error.message);
    return { ...DEFAULT_RIDER_PREFERENCES, ...(data ?? {}) };
  }

  static async updatePreferences(userId: string, changes: Partial<RiderPreferences>) {
    const { error } = await supabase.from('rider_preferences').upsert({ userId, ...changes, updatedAt: new Date().toISOString() });
    if (error) throw new Error(error.message);
  }

  static async getFamilyMembers(userId: string): Promise<FamilyMember[]> {
    const { data, error } = await supabase.from('family_members').select('*').eq('userId', userId).order('createdAt');
    if (error) throw new Error(error.message);
    return (data ?? []).map(({ id, name, relationship, phone }) => ({ id, name, relationship, phone: phone ?? undefined }));
  }

  static async addFamilyMember(userId: string, member: Omit<FamilyMember, 'id'>) {
    const { data, error } = await supabase.from('family_members').insert({ userId, ...member }).select('*').single();
    if (error) throw new Error(error.message);
    return { id: data.id, name: data.name, relationship: data.relationship, phone: data.phone ?? undefined } as FamilyMember;
  }

  static async updateFamilyMember(id: string, changes: Partial<Omit<FamilyMember, 'id'>>) {
    const { data, error } = await supabase
      .from('family_members')
      .update({ ...changes, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return { id: data.id, name: data.name, relationship: data.relationship, phone: data.phone ?? undefined } as FamilyMember;
  }

  static async deleteFamilyMember(id: string) {
    const { error } = await supabase.from('family_members').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}
