/**
 * Full-screen loader while session/state is resolved. Prevents flash of wrong content.
 */

export default function AuthGateLoader() {
  return (
    <div
      className="min-h-screen bg-background-primary flex items-center justify-center"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-8 w-8 rounded-full border-2 border-border-primary border-t-brand-primary animate-spin"
          aria-hidden
        />
        <p className="text-sm text-text-secondary">Checking access…</p>
      </div>
    </div>
  );
}
