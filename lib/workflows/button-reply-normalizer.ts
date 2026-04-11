export function normalizeButtonReplyText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
