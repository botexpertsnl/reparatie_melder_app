export type TenantUser = { id: string; name: string; email: string; role: "Owner" | "Manager" | "Operator" };

export type Tenant = {
  id: string;
  name: string;
  users: TenantUser[];
  monthlyCredits: number;
  oneTimeCredits: number;
  zernioProfileId?: string;
};

const STORAGE_KEY = "statusflow.admin-tenants";

export const defaultAdminTenants: Tenant[] = [
  {
    id: "ten_1",
    name: "AutoGarage De Vries",
    users: [
      { id: "u_1", name: "Sven de Vries", email: "sven@devries.nl", role: "Owner" },
      { id: "u_2", name: "Nina Bakker", email: "nina@devries.nl", role: "Manager" }
    ],
    monthlyCredits: 1500,
    oneTimeCredits: 240
  },
  {
    id: "ten_2",
    name: "FixIt Phone Repair",
    users: [{ id: "u_3", name: "Rik Jansen", email: "rik@fixit.nl", role: "Owner" }],
    monthlyCredits: 900,
    oneTimeCredits: 0
  }
];

function sanitizeTenant(tenant: Tenant): Tenant {
  const trimmedZernioProfileId = tenant.zernioProfileId?.trim();
  return {
    ...tenant,
    zernioProfileId: trimmedZernioProfileId || undefined
  };
}

export function readAdminTenants(): Tenant[] {
  if (typeof window === "undefined") return defaultAdminTenants;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAdminTenants;
    const parsed = JSON.parse(raw) as Tenant[];
    if (!Array.isArray(parsed)) return defaultAdminTenants;
    return parsed.map(sanitizeTenant);
  } catch {
    return defaultAdminTenants;
  }
}

export function writeAdminTenants(tenants: Tenant[]) {
  if (typeof window === "undefined") return;
  const sanitized = tenants.map(sanitizeTenant);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
}
