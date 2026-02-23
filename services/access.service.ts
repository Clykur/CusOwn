/**
 * Central access resolution: roles (string array) → capabilities.
 * Layouts call resolveUserAccess only; no business logic in layouts.
 * RLS-ready: role names align with DB roles.name; user_roles is source of truth.
 */

import type { NextRequest } from 'next/server';
import { getServerUser, getServerUserProfile } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';
import { ROUTES } from '@/lib/utils/navigation';
import {
  ROLES,
  CAPABILITIES,
  ROLE_CAPABILITIES,
  type RoleName,
  type CapabilityName,
} from '@/config/constants';
import { supabaseAdmin } from '@/lib/supabase/server';

const VALID_ROLES = new Set<string>(ROLES);
const VALID_CAPABILITIES = new Set<string>(Object.values(CAPABILITIES));

/** Map legacy user_type to roles array (for fallback when user_roles empty). */
function userTypeToRoles(userType: string | null): string[] {
  if (!userType) return [];
  switch (userType) {
    case 'admin':
      return ['admin'];
    case 'owner':
      return ['owner'];
    case 'customer':
      return ['customer'];
    case 'both':
      return ['customer', 'owner'];
    default:
      return [];
  }
}

/**
 * Get user's roles as string array from user_roles. Fallback to user_profiles.user_type.
 */
export async function getRoles(userId: string): Promise<string[]> {
  if (!userId) return [];
  if (!supabaseAdmin) return [];

  const { data: rows, error } = await supabaseAdmin
    .from('user_roles')
    .select('role_id, roles(name)')
    .eq('user_id', userId);

  if (error) {
    const profile = await getServerUserProfile(userId);
    return userTypeToRoles(profile?.user_type ?? null);
  }

  type RoleRow = { roles: { name: string } | { name: string }[] | null };
  const names = (rows ?? [])
    .map((r: RoleRow) => {
      const roles = r?.roles;
      if (Array.isArray(roles)) return roles[0]?.name;
      return roles?.name;
    })
    .filter((n): n is string => typeof n === 'string' && VALID_ROLES.has(n));
  if (names.length > 0) return [...new Set(names)];

  const profile = await getServerUserProfile(userId);
  return userTypeToRoles(profile?.user_type ?? null);
}

/**
 * Check if user has a role. Use for display or simple checks; use resolveUserAccess for route access.
 */
export async function hasRole(userId: string, role: string): Promise<boolean> {
  const roles = await getRoles(userId);
  return roles.includes(role);
}

/**
 * Derive capabilities from roles. Admin has all; owner/customer only their own.
 */
export function getCapabilitiesFromRoles(roles: string[]): Set<CapabilityName> {
  const set = new Set<CapabilityName>();
  for (const r of roles) {
    const caps = ROLE_CAPABILITIES[r as RoleName];
    if (caps) caps.forEach((c) => set.add(c));
  }
  return set;
}

export type ResolveAccessResult = {
  allowed: boolean;
  user: { id: string; email?: string } | null;
  profile: Awaited<ReturnType<typeof getServerUserProfile>>;
  redirectUrl: string | null;
  requireClientAuthCheck?: boolean;
  roles: string[];
  capabilities: Set<CapabilityName>;
};

export type ResolveAccessOptions = {
  requiredCapability: CapabilityName;
  baseUrl?: string;
};

/** Normalize host so duplicated hostnames (e.g. proxy misconfig) become a single host. */
function normalizeHost(host: string): string {
  const h = host.split(':')[0]?.toLowerCase() ?? host;
  // If host looks like "domain.comdomain.com", use first segment only.
  const mid = h.length / 2;
  if (mid >= 2 && h.slice(0, mid) === h.slice(mid)) {
    return host.replace(new RegExp(h.slice(mid) + '(?=:|$)', 'i'), '');
  }
  return host;
}

function buildBaseUrl(headers: Headers): string {
  let host = headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost';
  host = normalizeHost(host);
  const proto = headers.get('x-forwarded-proto') ?? 'http';
  const h = host.split(':')[0]?.toLowerCase();
  const port =
    process.env.NODE_ENV === 'development' && h === 'localhost' && !host.includes(':')
      ? ':3000'
      : '';
  return `${proto}://${h}${port ? (host.includes(':') ? host : host + port) : host}/`;
}

/**
 * Central entry for layout/route access. Resolves user, roles, capabilities; returns allowed + redirect.
 * Owner dashboard requires role 'owner' AND at least one business (capability alone is not enough).
 */
export async function resolveUserAccess(
  requestOrContext: NextRequest | null,
  options: ResolveAccessOptions
): Promise<ResolveAccessResult> {
  const { requiredCapability, baseUrl: optionBaseUrl } = options;
  if (!VALID_CAPABILITIES.has(requiredCapability)) {
    return {
      allowed: false,
      user: null,
      profile: null,
      redirectUrl: null,
      roles: [],
      capabilities: new Set(),
    };
  }

  let baseUrl: string;
  let request: Request;

  if (requestOrContext && 'url' in requestOrContext) {
    baseUrl = optionBaseUrl ?? `${new URL(requestOrContext.url).origin}/`;
    request = requestOrContext as Request;
  } else {
    const { headers } = await import('next/headers');
    const headersList = await headers();
    baseUrl = optionBaseUrl ?? buildBaseUrl(headersList as Headers);
    request = new Request(baseUrl, { headers: headersList as unknown as Headers });
  }

  const user = await getServerUser(request);
  const isLayoutContext = !requestOrContext || !('url' in requestOrContext);

  if (!user) {
    const pathname =
      request && 'nextUrl' in request ? (request as NextRequest).nextUrl?.pathname : undefined;
    const loginPath =
      typeof ROUTES.AUTH_LOGIN === 'function' ? ROUTES.AUTH_LOGIN(pathname) : '/auth/login';
    const loginUrl = new URL(loginPath, baseUrl);
    loginUrl.searchParams.set('redirect_from', 'guard');
    const redirectToLogin = loginUrl.toString();
    return {
      allowed: false,
      user: null,
      profile: null,
      redirectUrl: isLayoutContext ? null : redirectToLogin,
      requireClientAuthCheck: isLayoutContext,
      roles: [],
      capabilities: new Set(),
    };
  }

  const profile = await getServerUserProfile(user.id);
  const roles = await getRoles(user.id);
  const capabilities = getCapabilitiesFromRoles(roles);

  const hasCapability = capabilities.has(requiredCapability as CapabilityName);

  let allowed = hasCapability;

  if (requiredCapability === CAPABILITIES.ACCESS_OWNER_DASHBOARD && roles.includes('owner')) {
    const businesses = await userService.getUserBusinesses(user.id);
    allowed = businesses.length >= 1;
  }
  if (requiredCapability === CAPABILITIES.ACCESS_SETUP && roles.includes('owner')) {
    const businesses = await userService.getUserBusinesses(user.id);
    allowed = businesses.length === 0;
  }

  if (!profile) {
    allowed = false;
  }

  // Use path-only redirects so layouts get /path (no full URL); avoids doubled host from proxy/baseUrl.
  let redirectUrl: string | null = null;
  if (!allowed) {
    if (!profile) {
      redirectUrl = ROUTES.SELECT_ROLE();
    } else if (requiredCapability === CAPABILITIES.ACCESS_ADMIN_DASHBOARD) {
      void import('@/services/audit.service').then(({ auditService }) =>
        auditService.createAuditLog(user.id, 'admin_access_denied', 'user', {
          entityId: user.id,
          description: 'Attempted admin area without admin role',
          request: request as NextRequest,
        })
      );
      redirectUrl = ROUTES.HOME;
    } else if (requiredCapability === CAPABILITIES.ACCESS_OWNER_DASHBOARD) {
      redirectUrl = `${ROUTES.SELECT_ROLE('owner')}&error=not_owner`;
    } else if (requiredCapability === CAPABILITIES.ACCESS_CUSTOMER_DASHBOARD) {
      redirectUrl = `${ROUTES.SELECT_ROLE('customer')}&error=not_customer`;
    } else if (requiredCapability === CAPABILITIES.ACCESS_SETUP) {
      redirectUrl = ROUTES.OWNER_DASHBOARD_BASE;
    }
  }

  return {
    allowed,
    user: { id: user.id, email: user.email ?? undefined },
    profile,
    redirectUrl,
    roles,
    capabilities,
  };
}
