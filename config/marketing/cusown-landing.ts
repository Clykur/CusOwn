export const CUSOWN_LANDING_PEXELS_VIDEO_URL =
  'https://videos.pexels.com/video-files/3769021/3769021-hd_1920_1080_25fps.mp4' as const;

/** Desktop nav uses full-width bar above this scroll offset; beyond it, compact centered pill (landing + marketing pages). */
export const CUSOWN_LANDING_NAV_COMPACT_AFTER_SCROLL_PX = 72;

export const CUSOWN_LANDING_SECTION_IDS = {
  builtFor: 'built-for',
  platform: 'platform',
  preview: 'preview',
  capabilities: 'capabilities',
  pricing: 'pricing',
  process: 'process',
  faq: 'faq',
  roadmap: 'roadmap',
} as const;

/** Public marketing numbers for the CusOwn landing pricing block (INR). */
export const CUSOWN_PRICING = {
  trialDays: 7,
  monthlyInr: 1249,
  /** List price for 12 months before annual discount */
  annualListInr: 14988,
  annualDiscountPercent: 15,
} as const;

export const CUSOWN_PRICE_LOCALE = 'en-IN' as const;

/** Format a whole rupee amount for marketing copy (e.g. ₹12,740). */
export function formatCusownInr(amount: number): string {
  return `₹${amount.toLocaleString(CUSOWN_PRICE_LOCALE)}`;
}

/** Annual invoice after discount, rounded to the nearest rupee. */
export function cusownAnnualBilledInr(): number {
  return Math.round(
    CUSOWN_PRICING.annualListInr * (1 - CUSOWN_PRICING.annualDiscountPercent / 100)
  );
}

/** Image URLs for the product section on the marketing landing page. */
export const CUSOWN_PRODUCT_PREVIEW_IMAGES = {
  desktop:
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1600&q=85&auto=format&fit=crop',
  mobile:
    'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=900&q=85&auto=format&fit=crop',
  owner:
    'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&q=85&auto=format&fit=crop',
} as const;
