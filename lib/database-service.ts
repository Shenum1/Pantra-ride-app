import { supabase } from './supabase';

export class DatabaseService {
  static async create(tableName: string, data: any, customId?: string) {
    const payload = {
      ...this.cleanUndefined(data),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(customId ? { id: customId } : {}),
    };

    const { data: result, error } = await supabase
      .from(tableName)
      .insert(payload)
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return result?.id as string;
  }

  static async get(tableName: string, documentId: string) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) return null;
    return data;
  }

  static async getAll(tableName: string) {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  static async query(
    tableName: string,
    conditions: { field: string; operator: string; value: any }[],
    orderByField?: string,
    orderDirection: 'asc' | 'desc' = 'asc',
    limitCount?: number
  ) {
    let q = supabase.from(tableName).select('*');

    for (const cond of conditions) {
      if (cond.operator === '==' || cond.operator === 'eq') {
        q = q.eq(cond.field, cond.value) as any;
      } else if (cond.operator === '!=' || cond.operator === 'neq') {
        q = q.neq(cond.field, cond.value) as any;
      } else if (cond.operator === '>') {
        q = q.gt(cond.field, cond.value) as any;
      } else if (cond.operator === '>=') {
        q = q.gte(cond.field, cond.value) as any;
      } else if (cond.operator === '<') {
        q = q.lt(cond.field, cond.value) as any;
      } else if (cond.operator === '<=') {
        q = q.lte(cond.field, cond.value) as any;
      }
    }

    if (orderByField) {
      q = q.order(orderByField, { ascending: orderDirection === 'asc' }) as any;
    }

    if (limitCount) {
      q = q.limit(limitCount) as any;
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  static async update(tableName: string, documentId: string, data: any) {
    const { error } = await supabase
      .from(tableName)
      .update({ ...data, updatedAt: new Date().toISOString() })
      .eq('id', documentId);

    if (error) throw new Error(error.message);
  }

  static async delete(tableName: string, documentId: string) {
    const { error } = await supabase.from(tableName).delete().eq('id', documentId);
    if (error) throw new Error(error.message);
  }

  private static cleanUndefined(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    const cleaned: any = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = typeof obj[key] === 'object' && obj[key] !== null
          ? this.cleanUndefined(obj[key])
          : obj[key];
      }
    }
    return cleaned;
  }
}

export interface Ride {
  id?: string;
  userId: string;
  driverId?: string;
  pickupLocation: { lat: number; lng: number; address: string };
  dropoffLocation: { lat: number; lng: number; address: string };
  rideType: string;
  status: 'pending' | 'accepted' | 'in-progress' | 'completed' | 'cancelled';
  fare: number;
  distance: number;
  duration: number;
  scheduledTime?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Driver {
  id?: string;
  userId: string;
  vehicleType: string;
  vehicleModel: string;
  vehiclePlate: string;
  licenseNumber: string;
  rating: number;
  totalTrips: number;
  status: 'available' | 'busy' | 'offline';
  currentLocation?: { lat: number; lng: number };
  createdAt?: string;
  updatedAt?: string;
}
