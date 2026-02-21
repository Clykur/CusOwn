import { env } from '@/config/env';
import { createBrowserClient } from '@supabase/ssr';

/**
 * Client-side Supabase client. Session is also available via /api/auth/session.
 * Refresh is throttled by global fetch patch (see layout.tsx script).
 */
export const supabase = createBrowserClient(env.supabase.url, env.supabase.anonKey, {
  cookies: {
    get(name) {
      if (typeof document === 'undefined') return undefined;
      const cookies = document.cookie.split(';').map((c) => c.trim());
      const match = cookies.find((c) => c.startsWith(`${name}=`));
      return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : undefined;
    },
    set(name, value, options) {
      if (typeof document === 'undefined') return;
      const opts = options ?? {};
      const parts = [`${name}=${encodeURIComponent(value)}`];
      parts.push(`Path=${opts.path ?? '/'}`);
      if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
      if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
      if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
      if (opts.secure) parts.push('Secure');
      document.cookie = parts.join('; ');
    },
    remove(name, options) {
      if (typeof document === 'undefined') return;
      const opts = options ?? {};
      document.cookie = `${name}=; Path=${opts.path ?? '/'}; Max-Age=0`;
    },
  },
  auth: {
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
