/** Chart X-axis labels from `YYYY-MM-DD` (avoids UTC midnight shifting the calendar day). */
export function formatAnalyticsChartDayLabel(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return isoDate;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}
