/**
 * Strip control characters and line breaks from values before logging (CWE-117).
 */
export function sanitizeForLog(value: unknown): string {
  const str = value instanceof Error ? value.message : String(value ?? "");
  return str
    .replace(/[\r\n]+/g, " ")
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .slice(0, 500)
    .trim();
}
