/**
 * Client helper: fetch current user state from server.
 * Server remains source of truth (see `/api/user/state`).
 */

export async function fetchUserState(): Promise<any | null> {
  try {
    const res = await fetch('/api/user/state', { credentials: 'include' });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}
