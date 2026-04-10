export type StoredWorkflowStage = {
  id: string;
  name: string;
  key: string;
  description: string;
  color: string;
  isHidden?: boolean;
  visibleToCustomer: boolean;
  isStart?: boolean;
  isTerminal?: boolean;
  requiresApproval?: boolean;
  templateAutomationEnabled?: boolean;
  templateId?: string;
  templateSendDelayEnabled?: boolean;
  templateSendDelayHours?: number;
  templateSendDelayMinutes?: number;
  templateButtonActions?: StoredTemplateButtonAction[];
};

export type StoredTemplateButtonAction = {
  buttonId: string;
  buttonText?: string;
  sendQuickReplyEnabled?: boolean;
  quickReplyId?: string;
  moveToStageEnabled?: boolean;
  moveToStageId?: string;
};

const STORAGE_KEY = "statusflow.workflow-stages";

export const defaultWorkflowStages: StoredWorkflowStage[] = [
  { id: "stage_new", name: "New", key: "new", description: "Repair just received", color: "#6b7280", visibleToCustomer: true, isStart: true },
  { id: "stage_scheduled", name: "Scheduled", key: "scheduled", description: "Repair is scheduled", color: "#4e8de8", visibleToCustomer: true },
  { id: "stage_progress", name: "In Progress", key: "in_progress", description: "Being worked on", color: "#ecbd69", visibleToCustomer: true },
  { id: "stage_approval", name: "Awaiting Approval", key: "awaiting_approval", description: "Customer approval needed for additional work", color: "#fb923c", visibleToCustomer: true, requiresApproval: true },
  { id: "stage_not_approved", name: "Not Approved", key: "not_approved", description: "Customer did not approve the requested work", color: "#ef4444", visibleToCustomer: true },
  { id: "stage_approved", name: "Approved", key: "approved", description: "Customer approved and work can continue", color: "#22c55e", visibleToCustomer: true },
  { id: "stage_pickup", name: "Ready for Pickup", key: "ready_pickup", description: "Car is ready to be collected", color: "#22c1dc", visibleToCustomer: true },
  { id: "stage_completed", name: "Completed", key: "completed", description: "Repair completed", color: "#10b981", visibleToCustomer: true, isTerminal: true },
  { id: "stage_cancelled", name: "Cancelled", key: "cancelled", description: "Repair cancelled", color: "#ef4444", visibleToCustomer: true, isTerminal: true }
];

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
  window.dispatchEvent(new Event("workflow-stages:changed"));
}

export function filterVisibleWorkflowStages(stages: StoredWorkflowStage[]): StoredWorkflowStage[] {
  return stages.filter((stage) => !stage.isHidden);
}
