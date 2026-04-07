export type StoredWorkflowStage = {
  id: string;
  name: string;
  key: string;
  description: string;
  color: string;
  visibleToCustomer: boolean;
  isStart?: boolean;
  isTerminal?: boolean;
  requiresApproval?: boolean;
  templateAutomationEnabled?: boolean;
  templateId?: string;
};

const STORAGE_KEY = "statusflow.workflow-stages";

export function readStoredWorkflowStages(fallback: StoredWorkflowStage[]): StoredWorkflowStage[] {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as StoredWorkflowStage[];
    if (!Array.isArray(parsed)) return fallback;

    return parsed;
  } catch {
    return fallback;
  }
}

export function writeStoredWorkflowStages(stages: StoredWorkflowStage[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stages));
}
