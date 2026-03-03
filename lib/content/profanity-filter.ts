/**
 * Profanity filter for user-generated content (e.g. review comments).
 * Rejects if any configured blocked substring appears (case-insensitive).
 */

import { REVIEW_PROFANITY_WORDS } from '@/config/constants';

/**
 * Returns true if text contains any blocked profanity substring (case-insensitive).
 */
export function containsProfanity(text: string | null | undefined): boolean {
  if (text == null || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return REVIEW_PROFANITY_WORDS.some((word) => lower.includes(word));
}
