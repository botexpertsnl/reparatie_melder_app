import { normalizeButtonReplyText } from "@/lib/workflows/button-reply-normalizer";

export type NormalizedInboundMessage = {
  tenantId: string;
  provider: string;
  profileId?: string;
  accountId?: string;
  phoneNumberId?: string;
  conversationId?: string;
  customerId?: string;
  customerPhone?: string;
  messageId?: string;
  messageText: string;
  messageTextNormalized: string;
  occurredAt: string;
  rawPayload: unknown;
};

export function createNormalizedInboundMessage(payload: Omit<NormalizedInboundMessage, "messageTextNormalized">): NormalizedInboundMessage {
  return {
    ...payload,
    messageTextNormalized: normalizeButtonReplyText(payload.messageText)
  };
}
