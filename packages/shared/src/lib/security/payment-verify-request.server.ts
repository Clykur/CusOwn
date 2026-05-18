import { isValidUUID } from '../utils/security';

/** Razorpay/UPI HMAC-SHA256 hex digest length. */
const PAYMENT_SIGNATURE_HEX_RE = /^[0-9a-fA-F]{64}$/;

/** CusOwn-generated payment id (see generatePaymentId). */
const PAYMENT_PUBLIC_ID_RE = /^PAY[0-9A-Z]{10,80}$/i;

/** CusOwn-generated transaction id (see generateTransactionId). */
const TRANSACTION_ID_RE = /^TXN[0-9A-Z]{16,200}$/i;

export type PaymentVerifyRequestInput = {
  paymentId: string;
  transactionId: string;
  /** Raw signature field from body; validated before HMAC when required. */
  signatureField: unknown;
};

export type PaymentVerifyRequestParseFailure = {
  ok: false;
  status: 400;
  error: string;
};

export type PaymentVerifyRequestParseSuccess = {
  ok: true;
  input: PaymentVerifyRequestInput;
};

export type PaymentVerifyRequestParseResult =
  | PaymentVerifyRequestParseFailure
  | PaymentVerifyRequestParseSuccess;

function extractValidPaymentId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (isValidUUID(trimmed)) return trimmed;
  return PAYMENT_PUBLIC_ID_RE.test(trimmed) ? trimmed : null;
}

function extractValidTransactionId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return TRANSACTION_ID_RE.test(trimmed) ? trimmed : null;
}

/**
 * Parse and structurally validate payment verify POST body.
 * Trust boundary: route handlers must use only `input` from a successful parse.
 */
/** Thrown when POST body fails structural validation (maps to 400 in routes). */
export class PaymentVerifyClientError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PaymentVerifyClientError';
    this.status = status;
  }
}

export function parsePaymentVerifyRequest(body: unknown): PaymentVerifyRequestParseResult {
  const payload =
    body && typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

  const paymentId = extractValidPaymentId(payload.payment_id);
  if (paymentId === null) {
    return { ok: false, status: 400, error: 'Payment ID required' };
  }

  const transactionId = extractValidTransactionId(payload.transaction_id);
  if (transactionId === null) {
    return { ok: false, status: 400, error: 'Transaction ID required' };
  }

  const signatureField = payload.signature;
  if (signatureField !== undefined && typeof signatureField !== 'string') {
    return { ok: false, status: 400, error: 'Invalid signature format' };
  }

  return {
    ok: true,
    input: { paymentId, transactionId, signatureField },
  };
}

/** Returns a structurally valid signature string, or null. */
export function extractValidPaymentSignature(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return PAYMENT_SIGNATURE_HEX_RE.test(trimmed) ? trimmed : null;
}

/**
 * Validates body and returns trusted ids, or throws PaymentVerifyClientError.
 * Route handlers should use this instead of branching on user-controlled fields.
 */
export function requirePaymentVerifyRequest(body: unknown): PaymentVerifyRequestInput {
  const parsed = parsePaymentVerifyRequest(body);
  if (!parsed.ok) {
    throw new PaymentVerifyClientError(parsed.status, parsed.error);
  }
  return parsed.input;
}
