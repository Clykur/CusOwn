/**
 * SSR-safe profile loading UI (no skeleton-shimmer drift). Matches first paint on server and client.
 * Detailed skeletons render after mount in ProfilePageContent to avoid hydration mismatches.
 */
export function ProfileLoadingPlaceholder({ embedded = false }: { embedded?: boolean }) {
  if (embedded) {
    return (
      <div
        className="w-full pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-8"
        aria-busy="true"
      >
        <div className="space-y-4 animate-pulse" role="status" aria-label="Loading profile">
          <div className="h-44 rounded-xl bg-slate-100" />
          <div className="h-36 rounded-xl bg-red-50/50" />
          <div className="h-12 rounded-xl bg-slate-100 lg:hidden" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-white" aria-busy="true">
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 space-y-2 animate-pulse">
          <div className="h-8 w-48 max-w-full rounded-lg bg-slate-100 sm:h-9 sm:w-56" />
          <div className="h-4 w-full max-w-md rounded bg-slate-100" />
        </div>
        <div className="space-y-4 animate-pulse" role="status" aria-label="Loading profile">
          <div className="h-52 rounded-xl bg-slate-100" />
          <div className="h-40 rounded-xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
