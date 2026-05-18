export interface SalonData {
  providerName: string;
  location: string;
  ownerName: string;
  ownerPhone: string;
  ownerImage: string;
  bookingLink: string;
  ratingAvg?: number;
  reviewCount: number;
}

export interface BookingSlot {
  date: string;
  start_time: string;
  end_time: string;
}

export interface BookingReview {
  rating: number;
}

export interface Booking {
  id: string;
  booking_id: string;
  status: string;
  no_show?: boolean;
  customer_name: string;
  customer_phone: string;
  slot?: BookingSlot;
  review?: BookingReview;
  salon?: {
    salon_name?: string;
    location?: string;
    owner_name?: string;
    whatsapp_number?: string;
    booking_link?: string;
    rating_avg?: number;
    review_count?: number;
  };
  business?: {
    salon_name?: string;
    location?: string;
    owner_name?: string;
    whatsapp_number?: string;
    booking_link?: string;
    rating_avg?: number;
    review_count?: number;
  };
}

export interface RatingState {
  submittingRating: boolean;
  pendingRating: number;
  optimisticRating: number | null;
  ratingSuccess: boolean;
}
