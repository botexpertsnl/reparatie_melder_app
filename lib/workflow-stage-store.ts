import { normalizeButtonReplyText } from "@/lib/workflows/button-reply-normalizer";

export const DEFAULT_WORKFLOW_ID = "workflow_default";

export type WorkflowButtonActionType = "SEND_QUICK_REPLY" | "MOVE_TO_STAGE";

export type StoredWorkflowButtonActionMapping = {
  id: string;
  tenantId: string;
  workflowId: string;
  workflowStageId: string;
  templateId: string;
  templateButtonId: string;
  templateButtonText: string;
  templateButtonTextNormalized: string;
  actionType: WorkflowButtonActionType;
  actionConfig: {
    quickReplyId?: string;
    moveToStageId?: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  templateName?: string;
};

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
  id?: string;
  tenantId?: string;
  workflowId?: string;
  workflowStageId?: string;
  templateId?: string;
  buttonId: string;
  buttonText?: string;
  buttonTextNormalized?: string;
  sendQuickReplyEnabled?: boolean;
  quickReplyId?: string;
  moveToStageEnabled?: boolean;
  moveToStageId?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const STORAGE_KEY = "statusflow.workflow-stages";

export const defaultWorkflowStages: StoredWorkflowStage[] = [
  { id: "stage_new", name: "New", key: "new", description: "Repair just received", color: "#6b7280", visibleToCustomer: true, isStart: true },
  { id: "stage_scheduled", name: "Scheduled", key: "scheduled", description: "Repair is scheduled", color: "#4e8de8", visibleToCustomer: true },
  { id: "stage_progress", name: "In Progress", key: "in_progress", description: "Being worked on", color: "#ecbd69", visibleToCustomer: true },
  {
    id: "stage_approval",
    name: "Send offer",
    key: "awaiting_approval",
    description: "Customer approval needed for additional work",
    color: "#fb923c",
    visibleToCustomer: true,
    requiresApproval: true,
    templateAutomationEnabled: true,
    templateId: "tpl_3",
    templateSendDelayEnabled: false,
    templateSendDelayHours: 0,
    templateSendDelayMinutes: 0,
    templateButtonActions: []
  },
  { id: "stage_not_approved", name: "Not Approved", key: "not_approved", description: "Customer did not approve the requested work", color: "#ef4444", visibleToCustomer: true },
  { id: "stage_approved", name: "Approved", key: "approved", description: "Customer approved and work can continue", color: "#22c55e", visibleToCustomer: true },
  { id: "stage_pickup", name: "Ready for Pickup", key: "ready_pickup", description: "Car is ready to be collected", color: "#22c1dc", visibleToCustomer: true },
  { id: "stage_completed", name: "Completed", key: "completed", description: "Repair completed", color: "#10b981", visibleToCustomer: true, isTerminal: true },
  { id: "stage_cancelled", name: "Cancelled", key: "cancelled", description: "Repair cancelled", color: "#ef4444", visibleToCustomer: true, isTerminal: true }
];

function normalizeStageActions(stage: StoredWorkflowStage): StoredWorkflowStage {
  const normalizedActions = (stage.templateButtonActions ?? []).map((action) => {
    const buttonText = action.buttonText?.trim() ?? "";
    const nowIso = new Date().toISOString();

    return {
      ...action,
      buttonText,
      buttonTextNormalized: action.buttonTextNormalized ?? normalizeButtonReplyText(buttonText),
      isActive: action.isActive ?? true,
      createdAt: action.createdAt ?? nowIso,
      updatedAt: action.updatedAt ?? nowIso
    };
  });

  return {
    ...stage,
    templateButtonActions: normalizedActions
  };
}

export function readStoredWorkflowStages(fallback: StoredWorkflowStage[]): StoredWorkflowStage[] {
  if (typeof window === "undefined") {
    return fallback.map(normalizeStageActions);
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback.map(normalizeStageActions);

    const parsed = JSON.parse(raw) as StoredWorkflowStage[];
    if (!Array.isArray(parsed)) return fallback.map(normalizeStageActions);

    return parsed.map(normalizeStageActions);
  } catch {
    return fallback.map(normalizeStageActions);
  }
}

export function writeStoredWorkflowStages(stages: StoredWorkflowStage[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stages.map(normalizeStageActions)));
  window.dispatchEvent(new Event("workflow-stages:changed"));
}

export function filterVisibleWorkflowStages(stages: StoredWorkflowStage[]): StoredWorkflowStage[] {
  return stages.filter((stage) => !stage.isHidden);
}
