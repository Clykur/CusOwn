import { supabaseAdmin } from '@/lib/supabase/server';

export type UserType = 'owner' | 'customer' | 'both' | 'admin';

export interface UserProfile {
  id: string;
  user_type: UserType;
  full_name: string | null;
  phone_number: string | null;
  created_at: string;
  updated_at: string;
}

export class UserService {
  /**
   * Get user profile by user ID
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const DEBUG = process.env.NODE_ENV === 'development';
    
    if (DEBUG) {
      console.log('[USER_SERVICE] getUserProfile called for userId:', userId.substring(0, 8) + '...');
    }
    
    if (!supabaseAdmin) {
      console.error('[USER_SERVICE] Supabase admin not configured');
      throw new Error('Database not configured');
    }
    
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        if (DEBUG) console.log('[USER_SERVICE] Profile not found (PGRST116)');
        return null;
      }
      console.error('[USER_SERVICE] Error fetching profile:', {
        error: error.message,
        code: error.code,
        details: error.details,
      });
      throw new Error(error.message || 'Failed to fetch user profile');
    }

    if (DEBUG) {
      console.log('[USER_SERVICE] Profile found:', {
        userId: data.id,
        userType: data.user_type,
        fullName: data.full_name,
        hasPhone: !!data.phone_number,
      });
    }

    return data;
  }

  /**
   * Create or update user profile
   */
  async upsertUserProfile(
    userId: string,
    data: {
      user_type?: UserType;
      full_name?: string;
      phone_number?: string;
    }
  ): Promise<UserProfile> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .upsert(
        {
          id: userId,
          ...data,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
        }
      )
      .select()
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to update user profile');
    }

    return profile;
  }

  /**
   * Update user type (e.g., upgrade customer to owner)
   */
  async updateUserType(userId: string, userType: UserType): Promise<UserProfile> {
    return this.upsertUserProfile(userId, { user_type: userType });
  }

  /**
   * Check if user owns any businesses
   */
  async userOwnsBusinesses(userId: string): Promise<boolean> {
    if (!supabaseAdmin) {
      return false;
    }
    const { data, error } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('owner_user_id', userId)
      .limit(1);

    if (error) {
      return false;
    }

    return (data?.length || 0) > 0;
  }

  /**
   * Get all businesses owned by user
   */
  async getUserBusinesses(userId: string, includeSuspended = false) {
    const DEBUG = process.env.NODE_ENV === 'development';
    
    if (DEBUG) {
      console.log('[USER_SERVICE] getUserBusinesses called for userId:', userId.substring(0, 8) + '...');
    }
    
    if (!supabaseAdmin) {
      console.warn('[USER_SERVICE] Supabase admin not configured, returning empty array');
      return [];
    }
    
    let query = supabaseAdmin
      .from('businesses')
      .select('*')
      .eq('owner_user_id', userId);
    
    if (!includeSuspended) {
      query = query.eq('suspended', false);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[USER_SERVICE] Error fetching businesses:', {
        error: error.message,
        code: error.code,
        details: error.details,
      });
      throw new Error(error.message || 'Failed to fetch user businesses');
    }

    const businesses = data || [];
    
    if (DEBUG) {
      console.log('[USER_SERVICE] Businesses found:', {
        count: businesses.length,
        businesses: businesses.map((b: any) => ({
          id: b.id,
          name: b.salon_name,
          bookingLink: b.booking_link,
          ownerUserId: b.owner_user_id,
        })),
      });
    }

    return businesses;
  }

  /**
   * Get all bookings for a customer
   */
  async getUserBookings(userId: string) {
    if (!supabaseAdmin) {
      return [];
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        business:business_id (
          id,
          salon_name,
          location,
          address,
          whatsapp_number
        ),
        slot:slot_id (
          id,
          date,
          start_time,
          end_time,
          status
        )
      `)
      .eq('customer_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message || 'Failed to fetch user bookings');
    }

    return data || [];
  }
}

export const userService = new UserService();

