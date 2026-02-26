import { supabaseAdmin } from '@/lib/supabase/server';
import { ROLES, type RoleName } from '@/config/constants';

export type UserType = 'owner' | 'customer' | 'both' | 'admin';

export interface UserProfile {
  id: string;
  user_type: UserType;
  full_name: string | null;
  phone_number: string | null;
  profile_media_id?: string | null;
  created_at: string;
  updated_at: string;
}

export class UserService {
  /**
   * Get user profile by user ID
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
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
      if (error.code === 'PGRST116') return null;
      console.error('[USER_SERVICE] Error fetching profile:', {
        error: error.message,
        code: error.code,
        details: error.details,
      });
      throw new Error(error.message || 'Failed to fetch user profile');
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
   * Update user type (e.g., upgrade customer to owner). Kept for backward compat; syncs to user_roles.
   */
  async updateUserType(userId: string, userType: UserType): Promise<UserProfile> {
    const roleNames: string[] =
      userType === 'admin'
        ? ['admin']
        : userType === 'both'
          ? ['customer', 'owner']
          : userType === 'owner'
            ? ['owner']
            : ['customer'];
    await this.setUserRoles(userId, roleNames);
    const profile = await this.getUserProfile(userId);
    if (!profile) throw new Error('Profile not found after setUserRoles');
    return profile;
  }

  /**
   * Set user roles (string array). Writes user_roles and syncs user_profiles.user_type for RLS.
   * Does not allow setting admin via this method; use DB or admin flow.
   */
  async setUserRoles(userId: string, roleNames: string[]): Promise<void> {
    if (!supabaseAdmin) throw new Error('Database not configured');

    const valid = roleNames.filter((r) => ROLES.includes(r as RoleName));
    const { data: roleRows } = await supabaseAdmin
      .from('roles')
      .select('id, name')
      .in('name', valid);
    if (!roleRows?.length) {
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
      await this.upsertUserProfile(userId, { user_type: 'customer' });
      return;
    }

    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
    const inserts = roleRows.map((r) => ({ user_id: userId, role_id: r.id }));
    await supabaseAdmin.from('user_roles').insert(inserts);

    const names = roleRows.map((r) => r.name);
    const userType: UserType = names.includes('admin')
      ? 'admin'
      : names.includes('owner') && names.includes('customer')
        ? 'both'
        : names.includes('owner')
          ? 'owner'
          : names.includes('customer')
            ? 'customer'
            : 'customer';
    await this.upsertUserProfile(userId, { user_type: userType });
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
   * Get all businesses owned by user (excludes soft-deleted businesses)
   */
  async getUserBusinesses(userId: string, includeSuspended = false, includeDeleted = false) {
    if (!supabaseAdmin) {
      console.warn('[USER_SERVICE] Supabase admin not configured, returning empty array');
      return [];
    }

    let query = supabaseAdmin.from('businesses').select('*').eq('owner_user_id', userId);

    if (!includeSuspended) {
      query = query.eq('suspended', false);
    }

    // Filter out soft-deleted businesses unless explicitly requested
    if (!includeDeleted) {
      query = query.is('deleted_at', null);
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

    return data || [];
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
      .select(
        `
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
      `
      )
      .eq('customer_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message || 'Failed to fetch user bookings');
    }

    return data || [];
  }

  /**
   * Soft delete user account and all associated businesses.
   * Data is retained for 30 days for admin/recovery purposes.
   */
  async softDeleteAccount(
    userId: string,
    reason: string = 'User requested account deletion'
  ): Promise<{
    user_id: string;
    deleted_at: string;
    permanent_deletion_at: string;
    businesses_deleted: number;
  }> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    // Call the database function that handles soft delete
    const { data, error } = await supabaseAdmin.rpc('soft_delete_user_account', {
      p_user_id: userId,
      p_reason: reason,
    });

    if (error) {
      console.error('[USER_SERVICE] Error soft deleting account:', {
        error: error.message,
        code: error.code,
        details: error.details,
      });
      throw new Error(error.message || 'Failed to delete account');
    }

    return data;
  }

  /**
   * Check if user account is soft-deleted
   */
  async isAccountDeleted(
    userId: string
  ): Promise<{ deleted: boolean; deletedAt?: string; permanentDeletionAt?: string }> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('deleted_at, permanent_deletion_at')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return { deleted: false };
      throw new Error(error.message || 'Failed to check account status');
    }

    return {
      deleted: data?.deleted_at !== null,
      deletedAt: data?.deleted_at || undefined,
      permanentDeletionAt: data?.permanent_deletion_at || undefined,
    };
  }
}

export const userService = new UserService();

/** Soft delete response type */
export interface SoftDeleteResult {
  user_id: string;
  deleted_at: string;
  permanent_deletion_at: string;
  businesses_deleted: number;
}
