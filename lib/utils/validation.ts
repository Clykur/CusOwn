import { createSalonSchema, createBookingSchema } from '@/types';
import { ERROR_MESSAGES } from '@/config/constants';

export const validateCreateSalon = (data: unknown) => {
  try {
    return createSalonSchema.parse(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
  }
};

export const validateCreateBooking = (data: unknown) => {
  try {
    return createBookingSchema.parse(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
  }
};

export const validateTimeRange = (openingTime: string, closingTime: string): void => {
  const [openingHours, openingMinutes] = openingTime.split(':').map(Number);
  const [closingHours, closingMinutes] = closingTime.split(':').map(Number);

  const openingTotal = openingHours * 60 + openingMinutes;
  const closingTotal = closingHours * 60 + closingMinutes;

  if (closingTotal <= openingTotal) {
    throw new Error(ERROR_MESSAGES.TIME_INVALID);
  }
};
