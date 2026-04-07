export type StoredRepair = {
  id: string;
  title: string;
  description: string;
  customerName: string;
  customerPhone: string;
  assetName: string;
  stage: "Awaiting Approval" | "New" | "In Progress" | "Ready for Pickup";
  priority: "High" | "Medium" | "Low";
  status: "Open";
};

const STORAGE_KEY = "statusflow.repairs";

export const defaultRepairs: StoredRepair[] = [
  {
    id: "repair_1",
    title: "Cracked screen replacement",
    description: "Replace cracked front glass and run diagnostics",
    customerName: "Sophie de Jong",
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
    customerPhone: "+31 612333888",
    assetName: "Samsung Galaxy S23",
    stage: "New",
    priority: "High",
    status: "Open"
  }
];

export function readStoredRepairs(fallback: StoredRepair[]): StoredRepair[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as StoredRepair[];
    if (!Array.isArray(parsed)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

export function writeStoredRepairs(items: StoredRepair[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("repairs:changed"));
}
