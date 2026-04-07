const SUPER_ADMIN_KEY = "statusflow.super-admin";
const IMPERSONATING_KEY = "statusflow.impersonating-tenant";

export function isSuperAdmin() {
  if (typeof window === "undefined") return false;
  const value = window.localStorage.getItem(SUPER_ADMIN_KEY);
  if (value === null) return true;
  return value === "1";
}

export function setSuperAdmin(enabled: boolean) {
  if (typeof window === "undefined") return;
  if (enabled) {
    window.localStorage.setItem(SUPER_ADMIN_KEY, "1");
  } else {
    window.localStorage.removeItem(SUPER_ADMIN_KEY);
  }
}

export function getImpersonatingTenant() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(IMPERSONATING_KEY);
}

export function startImpersonation(tenantName: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(IMPERSONATING_KEY, tenantName);
}

export function stopImpersonation() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(IMPERSONATING_KEY);
}
