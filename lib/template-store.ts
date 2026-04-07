export type StoredTemplate = {
  id: string;
  name: string;
  category: string;
  language: string;
  body: string;
  spotlerId: string;
  active: boolean;
};

const STORAGE_KEY = "statusflow.templates";

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
