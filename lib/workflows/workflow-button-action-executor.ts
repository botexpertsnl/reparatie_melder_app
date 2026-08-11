import type { StoredWorkflowButtonActionMapping } from "@/lib/workflow-stage-store";

export type WorkflowActionExecutionResult = {
  actionType: StoredWorkflowButtonActionMapping["actionType"];
  moveToStageId?: string;
  quickReplyId?: string;
  autoReplyText?: string;
};

export function executeWorkflowButtonAction(mapping: StoredWorkflowButtonActionMapping): WorkflowActionExecutionResult {
  return {
    actionType: mapping.actionType,
    moveToStageId: mapping.actionConfig.moveToStageId,
    quickReplyId: mapping.actionConfig.quickReplyId,
    autoReplyText: mapping.actionConfig.autoReplyText
  };
}
