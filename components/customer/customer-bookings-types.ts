/** Minimal booking shape for customer dashboard table: one row per unique salon. */
export interface BookingForSalonRow {
  business_id: string;
  created_at: string;
  status: string;
  salon?: {
    salon_name?: string;
    owner_name?: string;
    whatsapp_number?: string;
    location?: string;
    address?: string;
  } | null;
}
