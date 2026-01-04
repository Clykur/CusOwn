export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
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

export const generateTimeSlots = (
  openingTime: string,
  closingTime: string,
  slotDuration: number
): Array<{ start: string; end: string }> => {
  const slots: Array<{ start: string; end: string }> = [];
  let currentTime = openingTime;

  while (isTimeBefore(currentTime, closingTime)) {
    const endTime = addMinutes(currentTime, slotDuration);

    if (isTimeAfter(endTime, closingTime) || endTime === closingTime) {
      break;
    }

    slots.push({
      start: currentTime,
      end: endTime,
    });

    currentTime = endTime;
  }

  return slots;
};

export const isSlotTimePassed = (slotDate: string, slotStartTime: string): boolean => {
  const today = new Date();
  const slotDateObj = new Date(slotDate);
  
  const todayDateString = today.toISOString().split('T')[0];
  const slotDateString = slotDateObj.toISOString().split('T')[0];
  
  if (slotDateString !== todayDateString) {
    return false;
  }
  
  const now = new Date();
  const [hours, minutes] = slotStartTime.split(':').map(Number);
  const slotDateTime = new Date(today);
  slotDateTime.setHours(hours, minutes, 0, 0);
  
  return now >= slotDateTime;
};

export const isTimeInRange = (time: string, openingTime: string, closingTime: string): boolean => {
  const timeMinutes = timeToMinutes(time);
  const openingMinutes = timeToMinutes(openingTime);
  const closingMinutes = timeToMinutes(closingTime);
  
  return timeMinutes >= openingMinutes && timeMinutes < closingMinutes;
};

