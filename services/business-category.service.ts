import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { cache } from 'react';
import { CACHE_TTL_STATIC_MS } from '@/config/constants';

export type BusinessCategoryItem = { value: string; label: string };

/** In-memory TTL cache for categories (reduces DB load across requests). */
let categoriesCache: { data: BusinessCategoryItem[]; expiresAt: number } | null = null;

function getCategoriesFromMemory(): BusinessCategoryItem[] | null {
  if (!categoriesCache || Date.now() > categoriesCache.expiresAt) return null;
  return categoriesCache.data;
}

function setCategoriesInMemory(data: BusinessCategoryItem[]): void {
  categoriesCache = { data, expiresAt: Date.now() + CACHE_TTL_STATIC_MS };
}

/**
 * Returns active business categories (available services) for Business type dropdown.
 * Source of truth is DB table business_categories; in-memory TTL + React cache.
 */
export const getBusinessCategories = cache(async (): Promise<BusinessCategoryItem[]> => {
  const fromMemory = getCategoriesFromMemory();
  if (fromMemory) return fromMemory;

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
    const list = data as BusinessCategoryItem[];
    setCategoriesInMemory(list);
    return list;
  } catch {
    return [];
  }
});

/** Returns allowed category values only (for validation). */
export async function getAllowedCategoryValues(): Promise<string[]> {
  const list = await getBusinessCategories();
  return list.map((c) => c.value);
}
