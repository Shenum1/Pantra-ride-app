import { supabase } from './supabase';
import type { Location, SavedLocation } from '@/types';

interface SavedLocationRow {
  id: string;
  name: string;
  address: string;
  latitude: number | string;
  longitude: number | string;
  type: SavedLocation['type'];
  icon: string | null;
}

function mapSavedLocation(row: SavedLocationRow): SavedLocation {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    type: row.type,
    icon: row.icon ?? undefined,
  };
}

export class SavedLocationsService {
  static async getSavedLocations(userId: string): Promise<SavedLocation[]> {
    const { data, error } = await supabase
      .from('saved_locations')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapSavedLocation(row as SavedLocationRow));
  }

  static async addSavedLocation(
    userId: string,
    location: Location,
    address: string,
    name: string,
    type: SavedLocation['type'],
    icon?: string
  ): Promise<SavedLocation> {
    if (type === 'home' || type === 'work') {
      const { data: existing } = await supabase
        .from('saved_locations')
        .select('id')
        .eq('userId', userId)
        .eq('type', type)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('saved_locations')
          .update({
            name,
            address,
            latitude: location.latitude,
            longitude: location.longitude,
            icon: icon ?? null,
            updatedAt: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('*')
          .single();

        if (error) throw new Error(error.message);
        return mapSavedLocation(data as SavedLocationRow);
      }
    }

    const { data, error } = await supabase
      .from('saved_locations')
      .insert({
        userId,
        name,
        address,
        latitude: location.latitude,
        longitude: location.longitude,
        type,
        icon: icon ?? (type === 'home' ? 'home' : type === 'work' ? 'briefcase' : 'star'),
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapSavedLocation(data as SavedLocationRow);
  }

  static async removeSavedLocation(userId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('saved_locations')
      .delete()
      .eq('id', id)
      .eq('userId', userId);

    if (error) throw new Error(error.message);
  }

  static async updateSavedLocation(
    userId: string,
    id: string,
    updates: Partial<SavedLocation>
  ): Promise<SavedLocation> {
    const payload: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.address !== undefined) payload.address = updates.address;
    if (updates.latitude !== undefined) payload.latitude = updates.latitude;
    if (updates.longitude !== undefined) payload.longitude = updates.longitude;
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.icon !== undefined) payload.icon = updates.icon;

    const { data, error } = await supabase
      .from('saved_locations')
      .update(payload)
      .eq('id', id)
      .eq('userId', userId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapSavedLocation(data as SavedLocationRow);
  }
}
