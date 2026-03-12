import { VALIDATION, ERROR_MESSAGES } from '@/config/constants';

export function validateAdminDeletionReason(reason: unknown): string | null {
  if (reason === undefined || reason === null) return ERROR_MESSAGES.DELETION_REASON_REQUIRED;
  const s = typeof reason === 'string' ? reason.trim() : '';
  if (s.length === 0) return ERROR_MESSAGES.DELETION_REASON_REQUIRED;
  if (s.length < VALIDATION.ADMIN_DELETION_REASON_MIN_LENGTH)
    return ERROR_MESSAGES.DELETION_REASON_TOO_SHORT;
  return null;
}

const DEPENDENCY_BLOCK_PATTERNS = [
  'outstanding payments',
  'last admin',
  'legal hold',
  'active (pending or confirmed) bookings exist',
  'already soft-deleted',
];

export function isDependencyBlockError(message: string): boolean {
  const lower = message.toLowerCase();
  return DEPENDENCY_BLOCK_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

export function isReasonRequiredError(message: string): boolean {
  return (
    message.includes('Deletion reason is mandatory') || message.includes('reason is mandatory')
  );
}
