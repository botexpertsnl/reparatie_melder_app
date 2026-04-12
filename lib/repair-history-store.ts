export type RepairHistoryActorType = "user" | "workflow";

export type StoredRepairHistoryItem = {
  id: string;
  repairId: string;
  atIso: string;
  fromStage: string;
  toStage: string;
  actorType: RepairHistoryActorType;
  actorName?: string;
};

const STORAGE_KEY = "statusflow.repair-history";

export function readStoredRepairHistory(fallback: StoredRepairHistoryItem[] = []): StoredRepairHistoryItem[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as StoredRepairHistoryItem[];
    if (!Array.isArray(parsed)) return fallback;

    return parsed.filter((item) =>
      Boolean(
        item &&
          typeof item.id === "string" &&
          typeof item.repairId === "string" &&
          typeof item.atIso === "string" &&
          typeof item.fromStage === "string" &&
          typeof item.toStage === "string" &&
          (item.actorType === "user" || item.actorType === "workflow")
      )
    );
  } catch {
    return fallback;
  }
}

export function writeStoredRepairHistory(items: StoredRepairHistoryItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("repair-history:changed"));
}
