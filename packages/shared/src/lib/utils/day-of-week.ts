/** JS Date.getDay(): 0 = Sunday … 6 = Saturday */

export const DAY_NAME_TO_JS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function dayNameToJsDay(name: string): number | null {
  const k = name.trim().toLowerCase();
  const v = DAY_NAME_TO_JS[k];
  return v === undefined ? null : v;
}
