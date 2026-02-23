/**
 * Legacy /b/ layout: passthrough only. Pages here redirect to /book/[slug].
 * No auth; no customer shell.
 */
export const dynamic = 'force-dynamic';

export default function BLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
