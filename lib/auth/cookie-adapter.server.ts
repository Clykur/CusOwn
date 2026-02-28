/**
 * Server-only: enforce secure attributes on auth/session cookies set by Supabase SSR.
 * Use this adapter in createServerClient and OAuth callback so all auth cookies get:
 * httpOnly, secure (in production), sameSite, path, bounded maxAge.
 */

const AUTH_COOKIE_MAX_AGE_SECONDS = 86400; // 24h, match config
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Cookie names that must get hardened attributes (Supabase uses sb-* and auth-related). */
function isAuthCookieName(name: string): boolean {
  const n = name.toLowerCase();
  return n.startsWith('sb-') || n.includes('auth') || n.includes('session');
}

export type NormalizedCookieOptions = {
  path: string;
  maxAge: number;
  sameSite: 'lax' | 'strict' | 'none';
  secure: boolean;
  httpOnly: boolean;
  expires?: Date;
};

/**
 * Normalize options so auth cookies always have secure attributes.
 * Non-auth cookies are passed through with defaults.
 */
export function normalizeCookieOptions(
  name: string,
  value: string,
  options?: Record<string, unknown>
): NormalizedCookieOptions {
  const opts = (options || {}) as Record<string, unknown>;
  const base: NormalizedCookieOptions = {
    path: (opts.path as string) ?? '/',
    maxAge: (opts.maxAge as number) ?? AUTH_COOKIE_MAX_AGE_SECONDS,
    sameSite: (opts.sameSite as 'lax' | 'strict' | 'none') ?? 'lax',
    secure: opts.secure !== undefined ? (opts.secure as boolean) : IS_PRODUCTION,
    httpOnly: opts.httpOnly !== undefined ? (opts.httpOnly as boolean) : true,
  };
  if (opts.expires) base.expires = opts.expires as Date;

  if (isAuthCookieName(name)) {
    base.httpOnly = true;
    base.secure = IS_PRODUCTION;
    base.sameSite = 'lax';
    base.path = '/';
    if (base.maxAge === undefined || base.maxAge <= 0) {
      base.maxAge = AUTH_COOKIE_MAX_AGE_SECONDS;
    }
  }

  return base;
}

/**
 * Adapter for Supabase SSR setAll: forces secure options for auth cookies.
 * Pass to cookies.setAll after mapping through normalizeCookieOptions.
 */
export function createSecureSetAll(
  cookieSet: (name: string, value: string, options?: Record<string, unknown>) => void
): (
  cookiesToSet: {
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }[]
) => void {
  return (cookiesToSet) => {
    cookiesToSet.forEach(({ name, value, options }) => {
      const n = normalizeCookieOptions(name, value, options);
      cookieSet(name, value, {
        path: n.path,
        maxAge: n.maxAge,
        sameSite: n.sameSite,
        secure: n.secure,
        httpOnly: n.httpOnly,
        ...(n.expires && { expires: n.expires }),
      });
    });
  };
}
