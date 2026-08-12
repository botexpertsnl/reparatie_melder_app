import { seededDummyRepairs } from "@/lib/mock-conversation-repair-seed";
import { getActiveTenantName } from "@/lib/tenant-settings-store";

export type StoredRepair = {
  id: string;
  contactIdentityId?: string;
  title: string;
  subtitle?: string;
  description: string;
  customerName: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone: string;
  assetName: string;
  stage: string;
  priority: "High" | "Medium" | "Low";
  status: "Open";
  isDummy?: boolean;
  dummyTag?: string;
  createdAt?: string;
  updatedAt?: string;
};

const LEGACY_STORAGE_KEY = "statusflow.repairs";
const STORAGE_KEY_PREFIX = "statusflow.repairs.customer";

function getStorageKey() {
  return `${STORAGE_KEY_PREFIX}.${encodeURIComponent(getActiveTenantName())}`;
}

function usesDemoData() {
  return getActiveTenantName().trim().toLowerCase() === "demo";
}

export const defaultRepairs: StoredRepair[] = [
  {
    id: "repair_1",
    title: "Cracked screen replacement",
    description: "Replace cracked front glass and run diagnostics",
    customerName: "Sophie de Jong",
    customerFirstName: "Sophie",
    customerLastName: "de Jong",
    customerPhone: "+31 612345604",
    assetName: "iPhone 14 Pro",
    stage: "In Progress",
    priority: "Medium",
    status: "Open"
  },
  {
    id: "repair_2",
    title: "Battery swollen - urgent",
    description: "Battery replacement and safety test",
    customerName: "Ahmed El Karimi",
    customerFirstName: "Ahmed",
    customerLastName: "El Karimi",
    customerPhone: "+31 612333888",
    assetName: "Samsung Galaxy S23",
    stage: "New",
    priority: "High",
    status: "Open"
  },
  ...seededDummyRepairs
];

export function readStoredRepairs(fallback: StoredRepair[]): StoredRepair[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(getStorageKey());
    if (!raw) {
      if (!usesDemoData()) return [];
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacy) return fallback;
      const parsedLegacy = JSON.parse(legacy) as StoredRepair[];
      return Array.isArray(parsedLegacy) ? parsedLegacy : fallback;
    }
    const parsed = JSON.parse(raw) as StoredRepair[];
    if (!Array.isArray(parsed)) return usesDemoData() ? fallback : [];
    return parsed;
  } catch {
    return usesDemoData() ? fallback : [];
  }
}

export function writeStoredRepairs(items: StoredRepair[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStorageKey(), JSON.stringify(items));
  window.dispatchEvent(new Event("repairs:changed"));
}
