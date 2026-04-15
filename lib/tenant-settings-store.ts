import { getImpersonatingTenant } from "@/lib/impersonation-store";

export type TenantSettings = {
  businessName: string;
  timezone: string;
  locale: string;
  repairLabel: string;
  assetLabel: string;
  customerLabel: string;
  identifierLabel: string;
  retentionPeriod: string;
  businessHours: BusinessHoursSettings;
};

export type BusinessHoursDayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export type BusinessHoursDayConfig = {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

export type BusinessHoursSettings = {
  timezone: "Europe/Amsterdam";
  days: Record<BusinessHoursDayKey, BusinessHoursDayConfig>;
  insideReplyEnabled: boolean;
  insideReplyMessage: string;
  outsideReplyEnabled: boolean;
  outsideReplyMessage: string;
  cooldownHours: number;
};

export const defaultBusinessHoursSettings: BusinessHoursSettings = {
  timezone: "Europe/Amsterdam",
  days: {
    monday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    tuesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    wednesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    thursday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    friday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    saturday: { isOpen: false, openTime: "10:00", closeTime: "16:00" },
    sunday: { isOpen: false, openTime: "10:00", closeTime: "16:00" }
  },
  insideReplyEnabled: false,
  insideReplyMessage: "Thanks for your message. We received it and will respond as soon as possible.",
  outsideReplyEnabled: false,
  outsideReplyMessage: "Thanks for your message. We're currently closed, but we'll get back to you during business hours.",
  cooldownHours: 8
};

const STORAGE_KEY = "statusflow.tenant-settings";

export const defaultTenantSettings: TenantSettings = {
  businessName: "FixIt Phone Repair",
  timezone: "Europe/Amsterdam",
  locale: "Dutch (NL)",
  repairLabel: "Repair",
  assetLabel: "Device",
  customerLabel: "Customer",
  identifierLabel: "Serial Number",
  retentionPeriod: "2 weeks",
  businessHours: defaultBusinessHoursSettings
};

function readAllTenantSettings() {
  if (typeof window === "undefined") return {} as Record<string, TenantSettings>;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {} as Record<string, TenantSettings>;
    const parsed = JSON.parse(raw) as Record<string, TenantSettings>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {} as Record<string, TenantSettings>;
  }
}

function writeAllTenantSettings(payload: Record<string, TenantSettings>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event("tenant-settings:changed"));
}

export function readTenantSettings(tenantName: string, fallback: TenantSettings = defaultTenantSettings): TenantSettings {
  const all = readAllTenantSettings();
  const stored = all[tenantName];
  if (!stored) return fallback;

  return {
    ...fallback,
    ...stored,
    businessHours: {
      ...fallback.businessHours,
      ...stored.businessHours,
      days: {
        ...fallback.businessHours.days,
        ...(stored.businessHours?.days ?? {})
      }
    }
  };
}

export function writeTenantSettings(tenantName: string, settings: TenantSettings) {
  const all = readAllTenantSettings();
  writeAllTenantSettings({ ...all, [tenantName]: settings });
}

export function getActiveTenantName() {
  if (typeof window === "undefined") return "AutoGarage De Vries";
  return getImpersonatingTenant() ?? "AutoGarage De Vries";
}

export function getActiveRepairLabel() {
  if (typeof window === "undefined") return defaultTenantSettings.repairLabel;
  const tenant = getActiveTenantName();
  return readTenantSettings(tenant, defaultTenantSettings).repairLabel || defaultTenantSettings.repairLabel;
}
