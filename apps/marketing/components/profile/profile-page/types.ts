export interface ProfileData {
  id: string;
  email: string;
  email_confirmed: boolean;
  created_at: string;
  last_sign_in: string | null;
  profile: {
    id: string;
    user_type: 'owner' | 'customer' | 'both' | 'admin';
    full_name: string | null;
    phone_number: string | null;
    created_at: string;
    updated_at: string;
    profile_media_id?: string | null;
    media: {
      id: string | null;
    } | null;
  } | null;
  statistics: {
    businessCount: number;
    bookingCount: number;
  };
  businesses: Array<{
    id: string;
    salon_name: string;
    booking_link: string;
    location: string | null;
    created_at: string;
  }>;
  recentBookings: Array<{
    id: string;
    booking_id: string;
    status: string;
    business_name: string;
    slot_date: string | null;
    slot_time: string | null;
    created_at: string;
  }>;
}

export interface ProfileFormData {
  full_name: string;
  phone_number: string;
}

export function getUserTypeLabel(type: string): string {
  switch (type) {
    case 'owner':
      return 'Business Owner';
    case 'customer':
      return 'Customer';
    case 'both':
      return 'Owner & Customer';
    case 'admin':
      return 'Administrator';
    default:
      return 'Unknown';
  }
}

export function getUserTypeColor(type: string): string {
  switch (type) {
    case 'owner':
      return 'bg-slate-100 text-slate-800';
    case 'customer':
      return 'bg-slate-100 text-slate-800';
    case 'both':
      return 'bg-slate-200 text-slate-900';
    case 'admin':
      return 'bg-slate-900 text-white';
    default:
      return 'bg-slate-100 text-slate-800';
  }
}
