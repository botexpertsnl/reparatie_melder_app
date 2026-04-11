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

  const mappings: StoredWorkflowButtonActionMapping[] = [];

  if (action.sendQuickReplyEnabled && action.quickReplyId) {
    mappings.push({
      ...common,
      id: `${common.id}_send_quick_reply`,
      actionType: "SEND_QUICK_REPLY",
      actionConfig: { quickReplyId: action.quickReplyId }
    });
  }

  if (action.moveToStageEnabled && action.moveToStageId) {
    mappings.push({
      ...common,
      id: `${common.id}_move_stage`,
      actionType: "MOVE_TO_STAGE",
      actionConfig: { moveToStageId: action.moveToStageId }
    });
  }

  return mappings;
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
