import type { NormalizedInboundMessage } from "@/lib/integrations/providers/normalized-inbound-message";
import type { StoredWorkflowButtonActionMapping } from "@/lib/workflow-stage-store";
import type { WorkflowActionRepository } from "@/lib/workflows/workflow-action-repository";

export type ButtonReplyMatchResult =
  | { status: "matched"; mapping: StoredWorkflowButtonActionMapping }
  | { status: "unmatched" }
  | { status: "ambiguous"; candidates: StoredWorkflowButtonActionMapping[] };

export function findMatchingWorkflowButtonAction(params: {
  repository: WorkflowActionRepository;
  inboundMessage: NormalizedInboundMessage;
  preferredWorkflowStageId?: string;
}): ButtonReplyMatchResult {
  const candidates = params.repository
    .listButtonActionMappings({ tenantId: params.inboundMessage.tenantId })
    .filter((item) => item.templateButtonTextNormalized === params.inboundMessage.messageTextNormalized);

  if (candidates.length === 0) return { status: "unmatched" };

  if (params.preferredWorkflowStageId) {
    const preferred = candidates.filter((item) => item.workflowStageId === params.preferredWorkflowStageId);
    if (preferred.length === 1) {
      return { status: "matched", mapping: preferred[0] };
    }
    if (preferred.length > 1) {
      return { status: "ambiguous", candidates: preferred };
    }
  }

  if (candidates.length > 1) {
    return { status: "ambiguous", candidates };
  }

  return { status: "matched", mapping: candidates[0] };
}
