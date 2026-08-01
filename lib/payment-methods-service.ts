import { supabase } from './supabase';
import type { PaymentMethod } from '@/types';

interface PaymentMethodRow {
  id: string;
  type: PaymentMethod['type'];
  name: string;
  lastFour: string | null;
  expiryDate: string | null;
  isDefault: boolean;
  icon: string | null;
}

function mapPaymentMethod(row: PaymentMethodRow): PaymentMethod {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    lastFour: row.lastFour ?? undefined,
    expiryDate: row.expiryDate ?? undefined,
    isDefault: row.isDefault,
    icon: row.icon ?? 'credit-card',
  };
}

export class PaymentMethodsService {
  static async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapPaymentMethod(row as PaymentMethodRow));
  }

  static async addPaymentMethod(
    userId: string,
    method: Omit<PaymentMethod, 'id'>
  ): Promise<PaymentMethod> {
    const { count } = await supabase
      .from('payment_methods')
      .select('id', { count: 'exact', head: true })
      .eq('userId', userId);

    const shouldBeDefault = method.isDefault || !count;

    if (shouldBeDefault) {
      await supabase
        .from('payment_methods')
        .update({ isDefault: false })
        .eq('userId', userId);
    }

    const { data, error } = await supabase
      .from('payment_methods')
      .insert({
        userId,
        type: method.type,
        name: method.name,
        lastFour: method.lastFour ?? null,
        expiryDate: method.expiryDate ?? null,
        isDefault: shouldBeDefault,
        icon: method.icon,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapPaymentMethod(data as PaymentMethodRow);
  }

  static async removePaymentMethod(userId: string, id: string): Promise<void> {
    const { data: removed, error: fetchError } = await supabase
      .from('payment_methods')
      .select('isDefault')
      .eq('id', id)
      .eq('userId', userId)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', id)
      .eq('userId', userId);

    if (error) throw new Error(error.message);

    if (removed?.isDefault) {
      const { data: remaining } = await supabase
        .from('payment_methods')
        .select('id')
        .eq('userId', userId)
        .order('createdAt', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (remaining) {
        await supabase
          .from('payment_methods')
          .update({ isDefault: true })
          .eq('id', remaining.id)
          .eq('userId', userId);
      }
    }
  }

  static async setDefaultPaymentMethod(userId: string, id: string): Promise<void> {
    await supabase
      .from('payment_methods')
      .update({ isDefault: false })
      .eq('userId', userId);

    const { error } = await supabase
      .from('payment_methods')
      .update({ isDefault: true })
      .eq('id', id)
      .eq('userId', userId);

    if (error) throw new Error(error.message);
  }
}
