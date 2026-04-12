import type { StoredConversation } from "@/lib/conversation-store";
import type { StoredRepair } from "@/lib/repair-store";

export type RepairStageChangeOptions = {
  sentTemplateMessage?: string;
  scheduledSendAtIso?: string;
};

type ApplyRepairStageChangeParams = {
  repairs: StoredRepair[];
  conversations: StoredConversation[];
  repairId: string;
  stageName: string;
  options?: RepairStageChangeOptions;
};

type ApplyRepairStageChangeResult = {
  repairs: StoredRepair[];
  conversations: StoredConversation[];
};

function buildOutgoingTemplateMessage(text: string, scheduledSendAtIso?: string) {
  return {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role: "agent" as const,
    text,
    at: "Now",
    scheduledForIso: scheduledSendAtIso
  };
}

export function applyRepairStageChange(params: ApplyRepairStageChangeParams): ApplyRepairStageChangeResult {
  const { repairs, conversations, repairId, stageName, options } = params;
  const normalizedTemplateText = options?.sentTemplateMessage?.trim() ?? "";

  const nextRepairs = repairs.map((repair) =>
    repair.id === repairId
      ? {
          ...repair,
          stage: stageName
        }
      : repair
  );

  if (!normalizedTemplateText) {
    return {
      repairs: nextRepairs,
      conversations
    };
  }

  const nextConversations = conversations.map((thread) => {
    if (thread.linkedRepairId !== repairId) return thread;

    return {
      ...thread,
      preview: normalizedTemplateText,
      updatedAt: "Now",
      open: true,
      messages: [...thread.messages, buildOutgoingTemplateMessage(normalizedTemplateText, options?.scheduledSendAtIso)]
    };
  });

  return {
    repairs: nextRepairs,
    conversations: nextConversations
  };
}
