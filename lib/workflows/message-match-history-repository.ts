import type { ButtonReplyMatchResult } from "@/lib/workflows/button-reply-matcher";

export type WorkflowMatchHistoryItem = {
  id: string;
  tenantId: string;
  inboundMessageId?: string;
  conversationId?: string;
  normalizedText: string;
  result: ButtonReplyMatchResult["status"];
  matchedMappingId?: string;
  createdAt: string;
};

const STORAGE_KEY = "statusflow.workflow-button-match-history";

export interface MatchHistoryRepository {
  record(item: WorkflowMatchHistoryItem): void;
}

export class LocalMatchHistoryRepository implements MatchHistoryRepository {
  record(item: WorkflowMatchHistoryItem): void {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    const current = raw ? ((JSON.parse(raw) as WorkflowMatchHistoryItem[]) ?? []) : [];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([item, ...current].slice(0, 200)));
  }
}
