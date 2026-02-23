/**
 * Public booking layout: no auth. For QR /book/{slug} only.
 */
export const dynamic = 'force-dynamic';

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-[1200px] py-8 px-6 sm:px-8 lg:px-10">{children}</div>
    </div>
  );
}
