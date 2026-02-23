import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { cache } from 'react';

export type BusinessCategoryItem = { value: string; label: string };

/**
 * Returns active business categories (available services) for Business type dropdown.
 * Source of truth is DB table business_categories; no hardcoded list.
 */
export const getBusinessCategories = cache(async (): Promise<BusinessCategoryItem[]> => {
  try {
    const supabaseAdmin = requireSupabaseAdmin();
    if (!supabaseAdmin) return [];

    const { data, error } = await supabaseAdmin
      .from('business_categories')
      .select('value, label')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });

    if (error || !data?.length) return [];
    return data as BusinessCategoryItem[];
  } catch {
    return [];
  }
});

/** Returns allowed category values only (for validation). */
export async function getAllowedCategoryValues(): Promise<string[]> {
  const list = await getBusinessCategories();
  return list.map((c) => c.value);
}
