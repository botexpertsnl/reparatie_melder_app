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

export function dedupeConversationsById(items: StoredConversation[]): StoredConversation[] {
  const byId = new Map<string, StoredConversation>();
  items.forEach((conversation) => {
    byId.set(conversation.id, conversation);
  });
  return Array.from(byId.values());
}

export function readStoredConversations(fallback: StoredConversation[]): StoredConversation[] {
  if (typeof window === "undefined") return dedupeConversationsById(fallback);

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return dedupeConversationsById(fallback);
    const parsed = JSON.parse(raw) as StoredConversation[];
    if (!Array.isArray(parsed)) return dedupeConversationsById(fallback);
    return dedupeConversationsById(parsed);
  } catch {
    return dedupeConversationsById(fallback);
  }
}

export function writeStoredConversations(items: StoredConversation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dedupeConversationsById(items)));
  window.dispatchEvent(new Event("conversations:changed"));
}
