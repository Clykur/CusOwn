'use client';

import { useState, useEffect } from 'react';
import { supabaseAuth } from '@cusown/shared';

// Force dynamic rendering - this page requires runtime data
export const dynamic = 'force-dynamic';

export default function DebugAuthPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDebugInfo = async () => {
      try {
        // Get client-side session
        if (!supabaseAuth) {
          setError('Supabase not configured');
          setLoading(false);
          return;
        }
        const {
          data: { session },
          error: sessionError,
        } = await supabaseAuth.auth.getSession();

        console.log('[Debug] Client session:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          hasToken: !!session?.access_token,
          userEmail: session?.user?.email,
          sessionError: sessionError?.message,
        });

        // Call debug endpoint
        const response = await fetch('/api/debug/auth');
        const data = await response.json();

        console.log('[Debug] Server debug response:', data);

        setDebugInfo({
          clientSession: {
            hasSession: !!session,
            hasUser: !!session?.user,
            hasToken: !!session?.access_token,
            userEmail: session?.user?.email,
            tokenLength: session?.access_token?.length,
          },
          serverDebug: data.data || data,
        });
      } catch (err) {
        console.error('[Debug] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchDebugInfo();
  }, []);

  if (loading) {
    return (
      <div className="w-full animate-pulse" aria-busy="true">
        <div className="h-8 bg-surface-card rounded-xl w-64 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-surface-card border border-border-primary rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <h2 className="text-lg font-bold text-state-error tracking-tight font-display mb-4">
          Error
        </h2>
        <p className="text-sm text-text-secondary font-mono bg-red-950/10 border border-red-500/20 p-4 rounded-xl">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="text-lg font-bold text-text-primary tracking-tight font-display mb-6">
        Authentication Debug Information
      </h2>

      <div className="space-y-6">
        {/* Client Session Info */}
        <section className="rounded-xl border border-border-primary bg-surface-card p-6">
          <h2 className="text-base font-bold text-text-primary font-display mb-4">
            Client-Side Session
          </h2>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-border-primary bg-[#0B0B0C] p-4 text-xs text-text-primary font-mono max-h-[300px]">
            {JSON.stringify(debugInfo?.clientSession, null, 2)}
          </pre>
        </section>

        {/* Server Debug Info */}
        <section className="rounded-xl border border-border-primary bg-surface-card p-6">
          <h2 className="text-base font-bold text-text-primary font-display mb-4">
            Server-Side Debug
          </h2>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-border-primary bg-[#0B0B0C] p-4 text-xs text-text-primary font-mono max-h-[300px]">
            {JSON.stringify(debugInfo?.serverDebug, null, 2)}
          </pre>
        </section>

        {/* Summary */}
        {debugInfo?.serverDebug?.summary && (
          <section className="rounded-xl border border-border-primary bg-surface-card p-6">
            <h2 className="text-base font-bold text-text-primary font-display mb-4">Summary</h2>
            <ul className="space-y-3 font-mono text-sm">
              <li className="flex justify-between border-b border-border-primary/20 pb-2">
                <span className="text-text-secondary">Authenticated:</span>{' '}
                <span
                  className={`font-semibold ${
                    debugInfo.serverDebug.summary.authenticated
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {debugInfo.serverDebug.summary.authenticated ? 'YES' : 'NO'}
                </span>
              </li>
              <li className="flex justify-between border-b border-border-primary/20 pb-2">
                <span className="text-text-secondary">Has Profile:</span>{' '}
                <span
                  className={`font-semibold ${
                    debugInfo.serverDebug.summary.hasProfile ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {debugInfo.serverDebug.summary.hasProfile ? 'YES' : 'NO'}
                </span>
              </li>
              <li className="flex justify-between border-b border-border-primary/20 pb-2">
                <span className="text-text-secondary">Is Admin:</span>{' '}
                <span
                  className={`font-semibold ${
                    debugInfo.serverDebug.summary.isAdmin ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {debugInfo.serverDebug.summary.isAdmin ? 'YES' : 'NO'}
                </span>
              </li>
              <li className="flex justify-between border-b border-border-primary/20 pb-2">
                <span className="text-text-secondary">Auth Method Used:</span>{' '}
                <span className="text-text-primary font-semibold">
                  {debugInfo.serverDebug.summary.authMethodUsed}
                </span>
              </li>
              <li className="flex justify-between pb-1">
                <span className="text-text-secondary">Has Errors:</span>{' '}
                <span
                  className={`font-semibold ${
                    debugInfo.serverDebug.summary.hasErrors ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {debugInfo.serverDebug.summary.hasErrors ? 'YES' : 'NO'}
                </span>
              </li>
            </ul>
          </section>
        )}

        {/* Errors */}
        {debugInfo?.serverDebug?.errors && debugInfo.serverDebug.errors.length > 0 && (
          <section className="rounded-xl border border-red-500/20 bg-red-950/10 p-6">
            <h2 className="text-base font-bold text-state-error font-display mb-4">Errors</h2>
            <ul className="list-disc list-inside space-y-1.5 font-mono text-sm text-red-400">
              {debugInfo.serverDebug.errors.map((err: string, idx: number) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Instructions */}
        <section className="rounded-xl border border-border-primary bg-surface-card p-6">
          <h2 className="text-base font-bold text-text-primary font-display mb-4">What to Check</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-text-secondary font-mono">
            <li>Check if client session has a valid token</li>
            <li>Check if server received the Authorization header</li>
            <li>Check if cookies are being set correctly</li>
            <li>Check if Supabase is configured properly</li>
            <li>Check console logs for detailed debugging information</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
