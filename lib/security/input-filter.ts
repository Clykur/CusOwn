/**
 * Input filtering utilities to prevent mass assignment attacks
 * Only allow explicitly whitelisted fields
 */

export const filterFields = <T extends Record<string, any>>(
  data: T,
  allowedFields: readonly (keyof T)[]
): Partial<T> => {
  const filtered: Partial<T> = {};
  for (const field of allowedFields) {
    if (field in data) {
      filtered[field] = data[field];
    }
  }
  return filtered;
};

export const filterBookingUpdateFields = (body: any): Partial<{
  status: string;
  customer_name: string;
  customer_phone: string;
  cancellation_reason: string;
  reason: string;
}> => {
  const allowedFields = ['status', 'customer_name', 'customer_phone', 'cancellation_reason', 'reason'] as const;
  return filterFields(body, allowedFields);
};

export const filterBusinessUpdateFields = (body: any): Partial<{
  salon_name: string;
  owner_name: string;
  whatsapp_number: string;
  opening_time: string;
  closing_time: string;
  slot_duration: number;
  address: string;
  location: string;
  category: string;
  suspended: boolean;
  suspended_reason: string;
}> => {
  const allowedFields = [
    'salon_name',
    'owner_name',
    'whatsapp_number',
    'opening_time',
    'closing_time',
    'slot_duration',
    'address',
    'location',
    'category',
    'suspended',
    'suspended_reason',
  ] as const;
  return filterFields(body, allowedFields);
};

export const filterUserProfileUpdateFields = (body: any): Partial<{
  user_type: string;
  full_name: string;
  phone_number: string;
}> => {
  const allowedFields = ['user_type', 'full_name', 'phone_number'] as const;
  return filterFields(body, allowedFields);
};

export const validateStringLength = (value: string, maxLength: number): boolean => {
  return typeof value === 'string' && value.length <= maxLength;
};

export const validateEnum = <T extends string>(value: unknown, allowedValues: readonly T[]): value is T => {
  return typeof value === 'string' && allowedValues.includes(value as T);
};
