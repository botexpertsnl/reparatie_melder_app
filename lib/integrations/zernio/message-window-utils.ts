const SERVICE_WINDOW_HOURS = 24;

export function isWithinWhatsappServiceWindow(lastInboundAt: Date, now: Date = new Date()): boolean {
  const elapsedMs = now.getTime() - lastInboundAt.getTime();
  return elapsedMs <= SERVICE_WINDOW_HOURS * 60 * 60 * 1000;
}
