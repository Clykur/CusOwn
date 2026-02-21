import AdminDashboardClient from './dashboard-client';

type Props = { searchParams: Promise<{ tab?: string }> };

export const revalidate = 60;

/**
 * Server component: pass tab from URL so the client does not use useSearchParams().
 * Session and role are resolved in layout; no session fetch in page.
 */
export default async function AdminDashboardPage({ searchParams }: Props) {
  const resolved = await searchParams;
  return <AdminDashboardClient initialTab={resolved?.tab} />;
}
