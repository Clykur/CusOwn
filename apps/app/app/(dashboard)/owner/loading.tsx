export default function OwnerLoading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading Owner Dashboard...</p>
      </div>
    </div>
  );
}
