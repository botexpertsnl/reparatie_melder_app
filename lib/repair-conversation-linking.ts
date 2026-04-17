import type { StoredConversation } from "@/lib/conversation-store";
import type { StoredRepair } from "@/lib/repair-store";

function buildConversationTimestampLabel(atIso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(atIso));
}

function createUniqueConversationId(existingIds: Set<string>) {
  let attempt = 0;
  let candidate = "";
  do {
    const suffix = Math.floor(Math.random() * 10_000).toString().padStart(4, "0");
    candidate = `th_${Date.now()}_${attempt}_${suffix}`;
    attempt += 1;
  } while (existingIds.has(candidate));

  existingIds.add(candidate);
  return candidate;
}

export function createLinkedConversationForRepair(
  repair: StoredRepair,
  existingConversationIds: Set<string>,
  createdAtIso = new Date().toISOString()
): StoredConversation {
  return {
    id: createUniqueConversationId(existingConversationIds),
    customerName: repair.customerName || repair.customerPhone,
    customerPhone: repair.customerPhone,
    preview: "",
    updatedAt: buildConversationTimestampLabel(createdAtIso),
    open: true,
    linkedRepairId: repair.id,
    messages: [],
    createdAt: createdAtIso,
  };
}

export function ensureRepairsHaveLinkedConversations(
  repairs: StoredRepair[],
  conversations: StoredConversation[]
) {
  const existingConversationIds = new Set(conversations.map((thread) => thread.id));
  const linkedRepairIds = new Set(
    conversations
      .map((thread) => thread.linkedRepairId)
      .filter((repairId): repairId is string => Boolean(repairId))
  );

  const missingRepairConversations = repairs
    .filter((repair) => !linkedRepairIds.has(repair.id))
    .map((repair) => createLinkedConversationForRepair(repair, existingConversationIds));

  return {
    conversations:
      missingRepairConversations.length > 0
        ? [...conversations, ...missingRepairConversations]
        : conversations,
    createdCount: missingRepairConversations.length
  };
}
