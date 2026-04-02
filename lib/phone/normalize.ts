export function sanitizePhoneNumber(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export function normalizeToE164(value: string, defaultCountryCode = "+31") {
  const cleaned = sanitizePhoneNumber(value);
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return `+${cleaned.slice(2)}`;
  if (cleaned.startsWith("0")) return `${defaultCountryCode}${cleaned.slice(1)}`;
  return `${defaultCountryCode}${cleaned}`;
}

export function comparePhoneNumbersSafely(a: string, b: string) {
  return normalizeToE164(a) === normalizeToE164(b);
}

export function formatForDisplay(value: string) {
  return normalizeToE164(value).replace(/(\+\d{2})(\d{2})(\d{3})(\d{4})/, "$1 $2 $3 $4");
}

export function deriveProviderContactId(phone: string) {
  return normalizeToE164(phone).replace("+", "");
}
