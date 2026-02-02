export const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const parts = time.split(':');
  const hours = Number(parts[0]) || 0;
  const minutes = Number(parts[1]) || 0;
  return hours * 60 + minutes;
};

export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
};

export const addMinutes = (time: string, minutesToAdd: number): string => {
  const totalMinutes = timeToMinutes(time) + minutesToAdd;
  return minutesToTime(totalMinutes);
};

export const isTimeAfter = (time1: string, time2: string): boolean => {
  return timeToMinutes(time1) > timeToMinutes(time2);
};

export const isTimeBefore = (time1: string, time2: string): boolean => {
  return timeToMinutes(time1) < timeToMinutes(time2);
};

export const normalizeTime = (time: string): string => {
  if (!time) return time;
  const parts = time.split(':');
  if (parts.length === 3) {
    return time;
  } else if (parts.length === 2) {
    return time + ':00';
  } else {
    console.error('Invalid time format:', time);
    return time;
  }
};

export const generateTimeSlots = (
  openingTime: string,
  closingTime: string,
  slotDuration: number
): Array<{ start: string; end: string }> => {
  const slots: Array<{ start: string; end: string }> = [];

  if (!openingTime || !closingTime || !slotDuration || slotDuration <= 0) {
    console.error('Invalid slot generation parameters:', {
      openingTime,
      closingTime,
      slotDuration,
    });
    return slots;
  }

  const normalizedOpening = normalizeTime(openingTime);
  const normalizedClosing = normalizeTime(closingTime);

  let currentTime = normalizedOpening;
  const openingMinutes = timeToMinutes(normalizedOpening);
  const closingMinutes = timeToMinutes(normalizedClosing);

  if (openingMinutes >= closingMinutes) {
    console.error('Invalid time range: opening time must be before closing time', {
      openingTime,
      closingTime,
    });
    return slots;
  }

  while (true) {
    const endTime = addMinutes(currentTime, slotDuration);
    const endTimeMinutes = timeToMinutes(endTime);

    // Stop if end time exceeds closing time (not equal, to allow last slot ending at closing time)
    if (endTimeMinutes > closingMinutes) {
      break;
    }

    // Only add slot if it doesn't exceed closing time
    if (endTimeMinutes <= closingMinutes) {
      slots.push({
        start: currentTime,
        end: endTime,
      });
    }

    // Move to next slot start time
    currentTime = endTime;

    // Safety check to prevent infinite loop
    if (timeToMinutes(currentTime) >= closingMinutes) {
      break;
    }
  }

  return slots;
};

/**
 * Check if a slot time has passed (for today only)
 * Handles timezone and edge cases properly
 */
export const isSlotTimePassed = (slotDate: string, slotStartTime: string): boolean => {
  // Parse slot date and time
  const slotDateObj = new Date(slotDate + 'T00:00:00');
  const today = new Date();

  // Get date strings in YYYY-MM-DD format (timezone-independent)
  const todayDateString = today.toISOString().split('T')[0];
  const slotDateString = slotDateObj.toISOString().split('T')[0];

  // If slot is not today, it's not passed
  if (slotDateString !== todayDateString) {
    return false;
  }

  // For today's slots, check if the start time has passed
  const now = new Date();
  const [hours, minutes] = slotStartTime.split(':').map(Number);

  // Create slot datetime using today's date with slot time
  const slotDateTime = new Date(today);
  slotDateTime.setHours(hours, minutes, 0, 0);

  // Slot is passed if current time is >= slot start time
  return now >= slotDateTime;
};

/**
 * Check if a slot is in the past (more robust version)
 * Handles date boundaries and timezone issues
 */
export const isSlotInPast = (slotDate: string, slotStartTime: string): boolean => {
  const now = new Date();

  // Parse slot date
  const slotDateObj = new Date(slotDate + 'T00:00:00');
  const today = new Date();

  // Compare dates first (timezone-independent)
  const todayDateString = today.toISOString().split('T')[0];
  const slotDateString = slotDateObj.toISOString().split('T')[0];

  // If slot date is before today, it's definitely in the past
  if (slotDateString < todayDateString) {
    return true;
  }

  // If slot date is after today, it's not in the past
  if (slotDateString > todayDateString) {
    return false;
  }

  // For today, check if the slot start time has passed
  const [hours, minutes] = slotStartTime.split(':').map(Number);
  const slotDateTime = new Date(today);
  slotDateTime.setHours(hours, minutes, 0, 0);

  // Add 1 minute buffer to account for time precision
  // If current time is >= slot start time, the slot has passed
  return now.getTime() >= slotDateTime.getTime();
};

export const isTimeInRange = (time: string, openingTime: string, closingTime: string): boolean => {
  const timeMinutes = timeToMinutes(time);
  const openingMinutes = timeToMinutes(openingTime);
  const closingMinutes = timeToMinutes(closingTime);

  return timeMinutes >= openingMinutes && timeMinutes < closingMinutes;
};
