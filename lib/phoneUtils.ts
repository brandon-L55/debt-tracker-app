/**
 * Remove formatting characters from a phone string.
 * Strips spaces, dashes, dots, and parentheses; preserves a leading '+'.
 *
 * "+1 (555) 123-4567" → "+15551234567"
 * "(555) 123-4567"    → "5551234567"
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-().]/g, "");
}

/**
 * Returns true when a string looks like a phone number:
 * an optional '+', then at least 7 digits (formatting chars allowed in input).
 */
export function isPhoneNumber(value: string): boolean {
  return /^\+?[\d\s\-().]{7,}$/.test(value.trim());
}
