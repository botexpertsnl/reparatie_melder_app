export type StoredTemplate = {
  id: string;
  name: string;
  category: string;
  language: string;
  body: string;
  spotlerId: string;
  active: boolean;
  variables?: {
    id: string;
    name: string;
    mode: "manual" | "repair_field";
    manualValue?: string;
    repairField?: "customerName" | "customerPhone" | "assetName" | "title" | "description" | "stage" | "priority";
  }[];
  buttons?: {
    id: string;
    type: "quick_reply" | "url" | "phone";
    text: string;
    value?: string;
  }[];
};

const STORAGE_KEY = "statusflow.templates";

export const defaultStoredTemplates: StoredTemplate[] = [
  {
    id: "tpl_1",
    name: "Device Received",
    category: "Update",
    language: "nl",
    body: "Hallo {{1}}, we hebben uw {{2}} ontvangen en gaan deze diagnosticeren. U ontvangt een update binnen 24 uur.",
    spotlerId: "",
    active: true,
    variables: [
      { id: "var_1", name: "Customer name", mode: "repair_field", repairField: "customerName" },
      { id: "var_2", name: "Device name", mode: "repair_field", repairField: "assetName" }
    ],
    buttons: []
  },
  {
    id: "tpl_2",
    name: "Device Ready",
    category: "Pickup",
    language: "nl",
    body: "Hallo {{1}}, uw {{2}} is gerepareerd en klaar voor ophalen! Kom langs op ons adres tijdens openingstijden.",
    spotlerId: "",
    active: true,
    variables: [
      { id: "var_3", name: "Customer name", mode: "repair_field", repairField: "customerName" },
      { id: "var_4", name: "Device name", mode: "repair_field", repairField: "assetName" }
    ],
    buttons: [{ id: "btn_1", type: "quick_reply", text: "Ik kom eraan" }]
  }
];

export function readStoredTemplates(fallback: StoredTemplate[]): StoredTemplate[] {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as StoredTemplate[];
    if (!Array.isArray(parsed)) {
      return fallback;
    }

    return parsed;
  } catch {
    return fallback;
  }
}

export function writeStoredTemplates(templates: StoredTemplate[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  window.dispatchEvent(new Event("templates:changed"));
}
