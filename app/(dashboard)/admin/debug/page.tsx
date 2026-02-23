'use client';

import { useState, useEffect } from 'react';
import { supabaseAuth } from '@/lib/supabase/auth';

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
        <div className="h-8 bg-gray-200 rounded w-64 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="text-3xl font-bold mb-6">Authentication Debug Information</h1>

      <div className="space-y-6">
        {/* Client Session Info */}
        <section className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Client-Side Session</h2>
          <pre className="bg-white p-4 rounded border overflow-auto text-sm">
            {JSON.stringify(debugInfo?.clientSession, null, 2)}
          </pre>
        </section>

        {/* Server Debug Info */}
        <section className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Server-Side Debug</h2>
          <pre className="bg-white p-4 rounded border overflow-auto text-sm">
            {JSON.stringify(debugInfo?.serverDebug, null, 2)}
          </pre>
        </section>

        {/* Summary */}
        {debugInfo?.serverDebug?.summary && (
          <section className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
            <h2 className="text-xl font-semibold mb-4">Summary</h2>
            <ul className="space-y-2">
              <li>
                <strong>Authenticated:</strong>{' '}
                <span
                  className={
                    debugInfo.serverDebug.summary.authenticated ? 'text-green-600' : 'text-red-600'
                  }
                >
                  {debugInfo.serverDebug.summary.authenticated ? 'Yes' : 'No'}
                </span>
              </li>
              <li>
                <strong>Has Profile:</strong>{' '}
                <span
                  className={
                    debugInfo.serverDebug.summary.hasProfile ? 'text-green-600' : 'text-red-600'
                  }
                >
                  {debugInfo.serverDebug.summary.hasProfile ? 'Yes' : 'No'}
                </span>
              </li>
              <li>
                <strong>Is Admin:</strong>{' '}
                <span
                  className={
                    debugInfo.serverDebug.summary.isAdmin ? 'text-green-600' : 'text-red-600'
                  }
                >
                  {debugInfo.serverDebug.summary.isAdmin ? 'Yes' : 'No'}
                </span>
              </li>
              <li>
                <strong>Auth Method Used:</strong> {debugInfo.serverDebug.summary.authMethodUsed}
              </li>
              <li>
                <strong>Has Errors:</strong>{' '}
                <span
                  className={
                    debugInfo.serverDebug.summary.hasErrors ? 'text-red-600' : 'text-green-600'
                  }
                >
                  {debugInfo.serverDebug.summary.hasErrors ? 'Yes' : 'No'}
                </span>
              </li>
            </ul>
          </section>
        )}

        {/* Errors */}
        {debugInfo?.serverDebug?.errors && debugInfo.serverDebug.errors.length > 0 && (
          <section className="bg-red-50 p-6 rounded-lg border-2 border-red-200">
            <h2 className="text-xl font-semibold mb-4 text-red-600">Errors</h2>
            <ul className="list-disc list-inside space-y-1">
              {debugInfo.serverDebug.errors.map((err: string, idx: number) => (
                <li key={idx} className="text-red-700">
                  {err}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Instructions */}
        <section className="bg-yellow-50 p-6 rounded-lg border-2 border-yellow-200">
          <h2 className="text-xl font-semibold mb-4">What to Check</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
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
