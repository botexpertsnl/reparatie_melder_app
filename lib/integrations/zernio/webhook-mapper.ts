import type { NormalizedZernioWebhookEvent } from "@/lib/integrations/zernio/webhooks";
import { createNormalizedInboundMessage, type NormalizedInboundMessage } from "@/lib/integrations/providers/normalized-inbound-message";

export function mapZernioWebhookToInboundMessage(event: NormalizedZernioWebhookEvent): NormalizedInboundMessage {
  return createNormalizedInboundMessage({
    tenantId: event.tenantId,
    provider: event.provider,
    accountId: event.accountId,
    profileId: event.profileId,
    phoneNumberId: event.phoneNumberId,
    conversationId: event.conversationId,
    messageId: event.messageId,
    customerPhone: event.sender,
    messageText: event.buttonPayload || event.body || "",
    occurredAt: event.timestamp,
    rawPayload: event
  });
}
