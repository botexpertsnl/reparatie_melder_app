export type TenantUser = {
  id: string;
  name: string;
  email: string;
};

const STORAGE_KEY = "statusflow.tenant-users";

const defaultTenantUsers: Record<string, TenantUser[]> = {
  "AutoGarage De Vries": [
    { id: "u_1", name: "Sven de Vries", email: "sven@devries.nl" },
    { id: "u_2", name: "Nina Bakker", email: "nina@devries.nl" }
  ],
  "FixIt Phone Repair": [{ id: "u_3", name: "Rik Jansen", email: "rik@fixit.nl" }]
};

function readAllTenantUsers() {
  if (typeof window === "undefined") return {} as Record<string, TenantUser[]>;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {} as Record<string, TenantUser[]>;
    const parsed = JSON.parse(raw) as Record<string, TenantUser[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {} as Record<string, TenantUser[]>;
  }
}

function writeAllTenantUsers(payload: Record<string, TenantUser[]>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function readTenantUsers(tenantName: string) {
  const all = readAllTenantUsers();
  return all[tenantName] ?? defaultTenantUsers[tenantName] ?? [];
}

export function writeTenantUsers(tenantName: string, users: TenantUser[]) {
  const all = readAllTenantUsers();
  writeAllTenantUsers({ ...all, [tenantName]: users });
}
