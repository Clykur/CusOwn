/** Build `tel:` href for salon WhatsApp / contact numbers on customer flows. */
export function salonTelHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `tel:+91${digits}`;
  if (digits.length > 10 && digits.startsWith('91')) return `tel:+${digits}`;
  return `tel:${phone}`;
}
