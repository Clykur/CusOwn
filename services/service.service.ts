import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { ERROR_MESSAGES } from '@/config/constants';
import { cache } from 'react';

export type Service = {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  duration_minutes: number;
  price_cents: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export class ServiceService {
  async getServicesByBusiness(businessId: string, activeOnly = true): Promise<Service[]> {
    const supabaseAdmin = requireSupabaseAdmin();

    let query = supabaseAdmin.from('services').select('*').eq('business_id', businessId);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data || [];
  }

  getServiceById = cache(async (serviceId: string): Promise<Service | null> => {
    const supabaseAdmin = requireSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data;
  });

  async validateServices(serviceIds: string[], businessId: string): Promise<Service[]> {
    const supabaseAdmin = requireSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('services')
      .select('*')
      .in('id', serviceIds)
      .eq('business_id', businessId)
      .eq('is_active', true);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!data || data.length !== serviceIds.length) {
      throw new Error('Invalid or inactive service');
    }

    return data;
  }

  async calculateTotalDuration(services: Service[]): Promise<number> {
    return services.reduce((total, service) => total + service.duration_minutes, 0);
  }

  async calculateTotalPrice(services: Service[]): Promise<number> {
    return services.reduce((total, service) => total + service.price_cents, 0);
  }
}

export const serviceService = new ServiceService();
