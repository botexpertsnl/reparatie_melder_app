import "server-only";

export type NormalizedZernioWebhookEvent = {
  provider: "zernio";
  tenantId: string;
  accountId?: string;
  conversationId?: string;
  messageId?: string;
  sender?: string;
  type: string;
  body?: string;
  buttonPayload?: string;
  attachments?: Array<{ url?: string; mimeType?: string; filename?: string }>;
  timestamp: string;
};

type ZernioWebhookPayload = {
  type?: string;
  accountId?: string;
  conversationId?: string;
  sender?: string;
  messageId?: string;
  timestamp?: string;
  body?: string;
  message?: {
    id?: string;
    conversationId?: string;
    from?: string;
    text?: string;
    interactive?: { buttonReply?: { payload?: string } };
    attachments?: Array<{ url?: string; mimeType?: string; filename?: string }>;
  };
};

export function normalizeZernioWebhookEvent(payload: ZernioWebhookPayload, tenantId: string): NormalizedZernioWebhookEvent {
  const message = payload.message ?? {};
  return {
    provider: "zernio",
    tenantId,
    accountId: payload?.accountId,
    conversationId: message?.conversationId ?? payload?.conversationId,
    messageId: message?.id ?? payload?.messageId,
    sender: message?.from ?? payload?.sender,
    type: payload?.type ?? "unknown",
    body: message?.text ?? payload?.body,
    buttonPayload: message?.interactive?.buttonReply?.payload,
    attachments: Array.isArray(message.attachments)
      ? message.attachments.map((attachment) => ({
          url: attachment.url,
          mimeType: attachment.mimeType,
          filename: attachment.filename
        }))
      : [],
    timestamp: payload?.timestamp ?? new Date().toISOString()
  };
}
