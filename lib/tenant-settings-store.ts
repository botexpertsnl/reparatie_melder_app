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
  retentionPeriod: "2 weeks"
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
  return all[tenantName] ?? fallback;
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
