const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidUUID = (id: string): boolean => {
  return UUID_REGEX.test(id);
};

export const validateBookingAccess = (
  bookingSalonId: string,
  requestedSalonId?: string
): boolean => {
  if (!requestedSalonId) {
    return true;
  }
  return bookingSalonId === requestedSalonId;
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

