/**
 * Dashboard route group. No auth here; each role layout (admin, owner, customer) runs resolveUserAccess.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
