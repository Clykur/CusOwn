import { redirect } from 'next/navigation';

type Props = { params: Promise<{ bookingLink: string }> };

/**
 * Legacy /b/[bookingLink]: redirect to canonical public booking /book/[bookingLink].
 * QR and links should use /book/; this keeps old /b/ links working.
 */
export default async function BRedirectPage({ params }: Props) {
  const { bookingLink } = await params;
  if (!bookingLink) redirect('/');
  redirect(`/book/${encodeURIComponent(bookingLink)}`);
}
