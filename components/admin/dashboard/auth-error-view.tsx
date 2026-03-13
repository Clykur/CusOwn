'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/utils/navigation';
import { getCSRFToken } from '@/lib/utils/csrf-client';

interface AuthErrorViewProps {
  authError: string;
  userEmail?: string;
  onRetry: () => void;
}

function AuthErrorViewComponent({ authError, userEmail, onRetry }: AuthErrorViewProps) {
  const router = useRouter();
  const isAllowedAdmin =
    userEmail === 'chinnuk0521@gmail.com' || userEmail === 'karthiknaramala9949@gmail.com';

  const handleTrySetAdmin = async () => {
    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
      const res = await fetch('/api/admin/check-status', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await res.json();
      if (data.success) {
        onRetry();
      } else {
        alert('Failed to set admin status: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      <div className="flex-1 w-full flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">{authError}</p>

          {authError.includes('migration') && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-left">
              <p className="text-sm text-yellow-800 mb-2">
                <strong>To fix this:</strong>
              </p>
              <ol className="text-sm text-yellow-700 list-decimal list-inside space-y-1">
                <li>Go to Supabase Dashboard → SQL Editor</li>
                <li>
                  Run the migration query from{' '}
                  <code className="bg-yellow-100 px-1 rounded">
                    database/migration_set_admin_quick.sql
                  </code>
                </li>
                <li>Refresh this page</li>
              </ol>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => router.push(ROUTES.HOME)}
              className="flex-1 px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors"
            >
              Go to Home
            </button>
            {isAllowedAdmin && (
              <button
                onClick={handleTrySetAdmin}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
              >
                Try Set Admin
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const AuthErrorView = memo(AuthErrorViewComponent);
