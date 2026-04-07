export type StoredConversation = {
  id: string;
  customerName: string;
  preview: string;
  updatedAt: string;
  open: boolean;
  messages: { id: string; role: "customer" | "agent"; text: string; at: string }[];
};

const STORAGE_KEY = "statusflow.conversations";

export const defaultConversations: StoredConversation[] = [
  {
    id: "th_1",
    customerName: "Alex Jansen",
    preview: "Your repair is in progress.",
    updatedAt: "10:12",
    open: false,
    messages: [{ id: "m_1", role: "customer", text: "Your repair is in progress.", at: "10:12" }]
  },
  {
    id: "th_2",
    customerName: "Noor Visser",
    preview: "Can you approve extra work?",
    updatedAt: "09:44",
    open: true,
    messages: [{ id: "m_2", role: "customer", text: "Can you approve extra work?", at: "09:44" }]
  },
  {
    id: "th_3",
    customerName: "Milan de Wit",
    preview: "Ready for pickup after 16:00.",
    updatedAt: "08:21",
    open: true,
    messages: [{ id: "m_3", role: "customer", text: "Ready for pickup after 16:00.", at: "08:21" }]
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
