import type { StoredConversation } from "@/lib/conversation-store";
import type { StoredRepairHistoryItem } from "@/lib/repair-history-store";
import type { StoredRepair } from "@/lib/repair-store";

export type RepairStageChangeActor =
  | {
      type: "user";
      name?: string;
    }
  | {
      type: "workflow";
    };

export type RepairStageChangeOptions = {
  sentTemplateMessage?: string;
  scheduledSendAtIso?: string;
  actor?: RepairStageChangeActor;
};

type ApplyRepairStageChangeParams = {
  repairs: StoredRepair[];
  conversations: StoredConversation[];
  historyItems?: StoredRepairHistoryItem[];
  repairId: string;
  stageName: string;
  options?: RepairStageChangeOptions;
};

type ApplyRepairStageChangeResult = {
  repairs: StoredRepair[];
  conversations: StoredConversation[];
  historyItems: StoredRepairHistoryItem[];
};

function buildOutgoingTemplateMessage(text: string, scheduledSendAtIso?: string) {
  return {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role: "agent" as const,
    text,
    at: "Now",
    scheduledForIso: scheduledSendAtIso,
    scheduledStatus: scheduledSendAtIso ? ("scheduled" as const) : undefined
  };
}

function buildRepairHistoryItem(
  repairId: string,
  fromStage: string,
  toStage: string,
  actor: RepairStageChangeActor
): StoredRepairHistoryItem {
  return {
    id: `rh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    repairId,
    atIso: new Date().toISOString(),
    fromStage,
    toStage,
    actorType: actor.type,
    actorName: actor.type === "user" ? actor.name?.trim() || "User" : undefined
  };
}

export function applyRepairStageChange(params: ApplyRepairStageChangeParams): ApplyRepairStageChangeResult {
  const { repairs, conversations, historyItems = [], repairId, stageName, options } = params;
  const normalizedTemplateText = options?.sentTemplateMessage?.trim() ?? "";

  const targetRepair = repairs.find((repair) => repair.id === repairId);
  const previousStage = targetRepair?.stage;
  const hasStageChanged = Boolean(targetRepair && previousStage !== stageName);

  const nextRepairs = repairs.map((repair) =>
    repair.id === repairId
      ? {
          ...repair,
          stage: stageName
        }
      : repair
  );

  const actor = options?.actor ?? { type: "user", name: "User" as string };
  const nextHistoryItems = hasStageChanged && previousStage
    ? [...historyItems, buildRepairHistoryItem(repairId, previousStage, stageName, actor)]
    : historyItems;

  if (!normalizedTemplateText) {
    return {
      repairs: nextRepairs,
      conversations,
      historyItems: nextHistoryItems
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
    conversations: nextConversations,
    historyItems: nextHistoryItems
  };
}
