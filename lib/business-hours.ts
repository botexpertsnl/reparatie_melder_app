import type { BusinessHoursDayConfig, BusinessHoursDayKey, BusinessHoursSettings } from "@/lib/tenant-settings-store";

export const BUSINESS_HOURS_TIMEZONE = "Europe/Amsterdam";
export const BUSINESS_REPLY_TYPE_INSIDE = "inside" as const;
export const BUSINESS_REPLY_TYPE_OUTSIDE = "outside" as const;

export type BusinessHoursReplyType = typeof BUSINESS_REPLY_TYPE_INSIDE | typeof BUSINESS_REPLY_TYPE_OUTSIDE;

const DAY_ORDER: BusinessHoursDayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

const AMSTERDAM_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  timeZone: BUSINESS_HOURS_TIMEZONE
});

const AMSTERDAM_TIME_PARTS_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: BUSINESS_HOURS_TIMEZONE
});

function parseTimeToMinutes(timeValue: string) {
  if (!/^\d{2}:\d{2}$/.test(timeValue)) return null;
  const [hoursText, minutesText] = timeValue.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function getAmsterdamContext(date: Date) {
  const weekdayRaw = AMSTERDAM_WEEKDAY_FORMATTER.format(date).toLowerCase();
  const weekday = weekdayRaw as BusinessHoursDayKey;

  const parts = AMSTERDAM_TIME_PARTS_FORMATTER.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  return {
    weekday,
    minutesSinceMidnight: (hour * 60) + minute
  };
}

export function isValidBusinessHoursDayRange(day: BusinessHoursDayConfig) {
  if (!day.isOpen) return true;
  const openMinutes = parseTimeToMinutes(day.openTime);
  const closeMinutes = parseTimeToMinutes(day.closeTime);
  if (openMinutes == null || closeMinutes == null) return false;
  if (openMinutes === closeMinutes) return false;
  return openMinutes < closeMinutes;
}

export function isWithinBusinessHours(settings: BusinessHoursSettings, at: Date = new Date()) {
  const { weekday, minutesSinceMidnight } = getAmsterdamContext(at);
  const day = settings.days[weekday];
  if (!day || !day.isOpen) return false;

  const openMinutes = parseTimeToMinutes(day.openTime);
  const closeMinutes = parseTimeToMinutes(day.closeTime);
  if (openMinutes == null || closeMinutes == null || openMinutes >= closeMinutes) return false;

  return minutesSinceMidnight >= openMinutes && minutesSinceMidnight < closeMinutes;
}

export function isBusinessDayActive(settings: BusinessHoursSettings, at: Date = new Date()) {
  const { weekday } = getAmsterdamContext(at);
  const day = settings.days[weekday];
  return Boolean(day?.isOpen && isValidBusinessHoursDayRange(day));
}

export function getBusinessHoursReplyType(settings: BusinessHoursSettings, at: Date = new Date()): BusinessHoursReplyType | null {
  const hasAnyValidConfiguredDay = DAY_ORDER.some((dayKey) => {
    const day = settings.days[dayKey];
    return Boolean(day?.isOpen && isValidBusinessHoursDayRange(day));
  });

  if (!hasAnyValidConfiguredDay) return null;

  return isWithinBusinessHours(settings, at)
    ? BUSINESS_REPLY_TYPE_INSIDE
    : BUSINESS_REPLY_TYPE_OUTSIDE;
}

export function shouldSendBusinessHoursAutoReply(params: {
  settings: BusinessHoursSettings;
  receivedAt?: Date;
  isInsideCooldownWindow: (replyType: BusinessHoursReplyType) => boolean;
}) {
  const receivedAt = params.receivedAt ?? new Date();
  const replyType = getBusinessHoursReplyType(params.settings, receivedAt);

  if (!replyType) {
    return { shouldSend: false as const, replyType: null, message: "" };
  }

  const isInside = replyType === BUSINESS_REPLY_TYPE_INSIDE;
  const enabled = isInside ? params.settings.insideReplyEnabled : params.settings.outsideReplyEnabled;
  const message = isInside ? params.settings.insideReplyMessage.trim() : params.settings.outsideReplyMessage.trim();

  if (!enabled || !message) {
    return { shouldSend: false as const, replyType, message };
  }

  if (params.isInsideCooldownWindow(replyType)) {
    return { shouldSend: false as const, replyType, message };
  }

  return { shouldSend: true as const, replyType, message };
}

export function getCooldownWindowMs(settings: BusinessHoursSettings) {
  const hours = Number.isFinite(settings.cooldownHours) ? settings.cooldownHours : 8;
  const sanitizedHours = Math.max(1, hours);
  return sanitizedHours * 60 * 60 * 1000;
}
