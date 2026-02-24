/**
 * Permission service: O(1) permission lookup via in-memory graph.
 * Loads role -> permissions once; user -> roles per request (or short TTL cache).
 * No hardcoded role string checks.
 */

import { requireSupabaseAdmin } from '@/lib/supabase/server';

/** role_id -> Set(permission_name). Built from role_permissions + permissions; refreshed by TTL. */
let rolePermissionsMap: Map<string, Set<string>> | null = null;
/** Last time the role-permissions map was built (ms). Used for TTL refresh. */
let rolePermissionsMapBuiltAt = 0;
const ROLE_PERMISSIONS_TTL_MS = 60_000;

/** Permission names used by API routes. */
export const PERMISSIONS = {
  ADMIN_ACCESS: 'admin:access',
  BUSINESSES_READ: 'businesses:read',
  BUSINESSES_WRITE: 'businesses:write',
  BOOKINGS_READ: 'bookings:read',
  BOOKINGS_WRITE: 'bookings:write',
  BOOKINGS_CONFIRM: 'bookings:confirm',
  BOOKINGS_REJECT: 'bookings:reject',
  SLOTS_READ: 'slots:read',
  SLOTS_WRITE: 'slots:write',
  AUDIT_READ: 'audit:read',
  USERS_READ: 'users:read',
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Build role_id -> Set(permission_name). O(roles + role_permissions); run once.
 */
async function buildRolePermissionsMap(): Promise<Map<string, Set<string>>> {
  const supabase = requireSupabaseAdmin();
  const [rpRes, permRes] = await Promise.all([
    supabase.from('role_permissions').select('role_id, permission_id'),
    supabase.from('permissions').select('id, name'),
  ]);
  if (rpRes.error) throw new Error(rpRes.error.message || 'Failed to load role_permissions');
  if (permRes.error) throw new Error(permRes.error.message || 'Failed to load permissions');
  const idToName = new Map<string, string>();
  for (const p of permRes.data ?? []) {
    idToName.set(p.id, p.name);
  }
  const map = new Map<string, Set<string>>();
  for (const rp of rpRes.data ?? []) {
    const name = idToName.get(rp.permission_id);
    if (!name) continue;
    let set = map.get(rp.role_id);
    if (!set) {
      set = new Set();
      map.set(rp.role_id, set);
    }
    set.add(name);
  }
  return map;
}

/**
 * Get role -> permissions map (cached). Rebuild on first use or when TTL elapsed.
 */
async function getRolePermissionsMap(): Promise<Map<string, Set<string>>> {
  const now = Date.now();
  if (rolePermissionsMap && now - rolePermissionsMapBuiltAt < ROLE_PERMISSIONS_TTL_MS) {
    return rolePermissionsMap;
  }
  rolePermissionsMap = await buildRolePermissionsMap();
  rolePermissionsMapBuiltAt = now;
  return rolePermissionsMap;
}

/**
 * Get set of permission names for a user (user_roles -> union of role permissions). O(roles per user) lookups in map.
 */
export async function getUserPermissionSet(userId: string): Promise<Set<string>> {
  const supabase = requireSupabaseAdmin();
  const { data: userRoles, error } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId);

  if (error) throw new Error(error.message || 'Failed to load user roles');
  const roleIds = (userRoles ?? []).map((r: { role_id: string }) => r.role_id);
  if (roleIds.length === 0) return new Set();

  const rpMap = await getRolePermissionsMap();
  const union = new Set<string>();
  for (const roleId of roleIds) {
    const perms = rpMap.get(roleId);
    if (perms) perms.forEach((p) => union.add(p));
  }
  return union;
}

/**
 * O(1) permission check: user has permission if name is in their permission set.
 */
export async function hasPermission(userId: string, permissionName: string): Promise<boolean> {
  const set = await getUserPermissionSet(userId);
  return set.has(permissionName);
}

/**
 * Invalidate cached role-permissions map (call after role_permissions change).
 */
export function invalidateRolePermissionsCache(): void {
  rolePermissionsMap = null;
  rolePermissionsMapBuiltAt = 0;
}
