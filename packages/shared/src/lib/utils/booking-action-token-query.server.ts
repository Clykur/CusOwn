import type { NextRequest } from 'next/server';

const MAX_QUERY_TOKEN_LEN = 500;

/** Outcome of reading `?token=` for booking owner-action / status links (not a security decision). */
export type BookingQueryTokenParse =
  | { kind: 'absent' }
  | { kind: 'malformed' }
  | { kind: 'present'; decoded: string };

/**
 * Normalizes the `token` search param for booking routes.
 * Callers decide auth using `kind` + server-side validation only — avoids branching
 * security-sensitive work on raw `searchParams.get('token')` truthiness (CodeQL).
 */
export function parseBookingActionQueryToken(request: NextRequest): BookingQueryTokenParse {
  const params = request.nextUrl.searchParams;
  if (!params.has('token')) {
    return { kind: 'absent' };
  }

  const raw = params.get('token');
  if (
    raw === null ||
    typeof raw !== 'string' ||
    raw.length === 0 ||
    raw.length > MAX_QUERY_TOKEN_LEN
  ) {
    return { kind: 'malformed' };
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return { kind: 'malformed' };
  }

  if (!decoded) {
    return { kind: 'malformed' };
  }

  return { kind: 'present', decoded };
}
