import type { StoredWorkflowButtonActionMapping } from "@/lib/workflow-stage-store";
import type { WorkflowActionRepository } from "@/lib/workflows/workflow-action-repository";

export type ButtonReplyConflict = {
  normalizedText: string;
  existing: StoredWorkflowButtonActionMapping;
};

export function detectButtonReplyConflicts(params: {
  repository: WorkflowActionRepository;
  tenantId: string;
  candidateMappings: Array<{ normalizedText: string }>;
  excludeWorkflowStageId?: string;
}): ButtonReplyConflict[] {
  const existingMappings = params.repository.listButtonActionMappings({
    tenantId: params.tenantId,
    excludeWorkflowStageId: params.excludeWorkflowStageId
  });

  const mapByNormalizedText = new Map<string, StoredWorkflowButtonActionMapping>();
  for (const mapping of existingMappings) {
    mapByNormalizedText.set(mapping.templateButtonTextNormalized, mapping);
  }

  return params.candidateMappings
    .map((candidate) => {
      const existing = mapByNormalizedText.get(candidate.normalizedText);
      if (!existing) return null;
      return {
        normalizedText: candidate.normalizedText,
        existing
      } as ButtonReplyConflict;
    })
    .filter((item): item is ButtonReplyConflict => Boolean(item));
}
