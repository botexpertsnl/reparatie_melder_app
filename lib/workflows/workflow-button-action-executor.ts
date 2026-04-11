import type { StoredWorkflowButtonActionMapping } from "@/lib/workflow-stage-store";

export type WorkflowActionExecutionResult = {
  actionType: StoredWorkflowButtonActionMapping["actionType"];
  moveToStageId?: string;
  quickReplyId?: string;
};

export function executeWorkflowButtonAction(mapping: StoredWorkflowButtonActionMapping): WorkflowActionExecutionResult {
  if (mapping.actionType === "MOVE_TO_STAGE") {
    return {
      actionType: mapping.actionType,
      moveToStageId: mapping.actionConfig.moveToStageId
    };
  }

  return {
    actionType: mapping.actionType,
    quickReplyId: mapping.actionConfig.quickReplyId
  };
}
