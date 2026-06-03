export default function OwnerLoading() {
  return (
    <div className="min-h-screen bg-surface-card flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-border-primary border-t-brand-primary rounded-full animate-spin" />
        <p className="text-text-secondary text-sm">Loading Owner Dashboard...</p>
      </div>
    </div>
  );
}
