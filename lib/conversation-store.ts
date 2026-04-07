export type StoredConversation = {
  id: string;
  customerName: string;
  customerPhone: string;
  preview: string;
  updatedAt: string;
  open: boolean;
  linkedRepairId?: string;
  messages: { id: string; role: "customer" | "agent"; text: string; at: string }[];
};

const STORAGE_KEY = "statusflow.conversations";

export const defaultConversations: StoredConversation[] = [
  {
    id: "th_1",
    customerName: "Sophie de Jong",
    customerPhone: "+31 612345604",
    preview: "Hoe lang duurt de reparatie nog?",
    updatedAt: "10:54",
    open: true,
    linkedRepairId: "repair_1",
    messages: [{ id: "m_1", role: "customer", text: "Hoe lang duurt de reparatie nog?", at: "10:54" }]
  },
  {
    id: "th_2",
    customerName: "+31 612000111",
    customerPhone: "+31 612000111",
    preview: "Hallo, kunnen jullie mijn scherm fixen?",
    updatedAt: "09:12",
    open: true,
    messages: [{ id: "m_2", role: "customer", text: "Hallo, kunnen jullie mijn scherm fixen?", at: "09:12" }]
  }
];

export function readStoredConversations(fallback: StoredConversation[]): StoredConversation[] {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as StoredConversation[];
    if (!Array.isArray(parsed)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

export function writeStoredConversations(items: StoredConversation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("conversations:changed"));
}
