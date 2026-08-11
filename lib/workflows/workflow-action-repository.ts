import { getActiveTenantName } from "@/lib/tenant-settings-store";
import {
  DEFAULT_WORKFLOW_ID,
  type StoredTemplateButtonAction,
  type StoredWorkflowButtonActionMapping,
  type StoredWorkflowStage
} from "@/lib/workflow-stage-store";

export interface WorkflowActionRepository {
  listButtonActionMappings(params: {
    tenantId: string;
    excludeWorkflowStageId?: string;
  }): StoredWorkflowButtonActionMapping[];
}

function actionToMappings(params: {
  tenantId: string;
  stage: StoredWorkflowStage;
  action: StoredTemplateButtonAction;
}): StoredWorkflowButtonActionMapping[] {
  const { tenantId, stage, action } = params;
  const nowIso = new Date().toISOString();
  const templateId = stage.templateId ?? action.templateId ?? "";
  const workflowId = action.workflowId ?? DEFAULT_WORKFLOW_ID;
  const workflowStageId = stage.id;
  const common = {
    id: action.id ?? `${workflowStageId}_${action.buttonId}`,
    tenantId,
    workflowId,
    workflowStageId,
    templateId,
    templateButtonId: action.buttonId,
    templateButtonText: action.buttonText ?? "",
    templateButtonTextNormalized: action.buttonTextNormalized ?? "",
    isActive: action.isActive ?? true,
    createdAt: action.createdAt ?? nowIso,
    updatedAt: action.updatedAt ?? nowIso
  };

  const autoReplyText = action.sendQuickReplyEnabled ? action.autoReplyText?.trim() : undefined;
  const quickReplyId = action.sendQuickReplyEnabled ? action.quickReplyId : undefined;
  const moveToStageId = action.moveToStageEnabled ? action.moveToStageId : undefined;
  if (!autoReplyText && !quickReplyId && !moveToStageId) return [];

  return [{
    ...common,
    actionType: autoReplyText || quickReplyId ? "SEND_QUICK_REPLY" : "MOVE_TO_STAGE",
    actionConfig: { autoReplyText, quickReplyId, moveToStageId }
  }];
}

export class LocalWorkflowActionRepository implements WorkflowActionRepository {
  private readonly stages: StoredWorkflowStage[];

  constructor(stages: StoredWorkflowStage[]) {
    this.stages = stages;
  }

  listButtonActionMappings(params: {
    tenantId: string;
    excludeWorkflowStageId?: string;
  }): StoredWorkflowButtonActionMapping[] {
    return this.stages
      .filter((stage) => stage.templateAutomationEnabled && stage.templateId)
      .filter((stage) => (params.excludeWorkflowStageId ? stage.id !== params.excludeWorkflowStageId : true))
      .flatMap((stage) =>
        (stage.templateButtonActions ?? []).flatMap((action) =>
          actionToMappings({
            tenantId: params.tenantId,
            stage,
            action
          })
        )
      )
      .filter((item) => item.templateButtonTextNormalized.length > 0 && item.isActive);
  }
}

export function getLocalTenantId() {
  return getActiveTenantName();
}
