import "server-only";
import { zernioFetch } from "@/lib/integrations/zernio/client";

export type ZernioAccount = {
  id: string;
  profileId?: string;
  platform?: string;
  providerAccountId?: string;
  displayName?: string;
  status?: string;
};

export type ZernioConversation = {
  id: string;
  accountId?: string;
  profileId?: string;
  customer?: { id?: string; name?: string; phone?: string };
  participant?: { name?: string; phone?: string };
  lastMessage?: { id?: string; text?: string; body?: string; createdAt?: string; timestamp?: string };
  updatedAt?: string;
  status?: string;
};

export type ZernioMessage = {
  id: string;
  type?: string;
  direction?: "inbound" | "outbound" | string;
  status?: string;
  text?: { body?: string };
  body?: string;
  createdAt?: string;
  timestamp?: string;
  sender?: { phone?: string; name?: string };
  attachments?: Array<{ id?: string; url?: string; filename?: string; mimeType?: string }>;
};

export async function listZernioAccounts(profileId: string, platform = "whatsapp") {
  return zernioFetch<{ data?: ZernioAccount[]; accounts?: ZernioAccount[] }>(
    `/v1/accounts?profileId=${encodeURIComponent(profileId)}&platform=${encodeURIComponent(platform)}`
  );
}

export async function listZernioPhoneNumbers() {
  return zernioFetch<{ data?: Array<{ id: string; phoneNumber?: string; displayNumber?: string; accountId?: string }> }>(
    "/v1/whatsapp/phone-numbers"
  );
}

export async function listZernioConversations(params: {
  profileId: string;
  accountId: string;
  platform?: string;
  status?: string;
  sortOrder?: "asc" | "desc";
  limit?: number;
  cursor?: string;
}) {
  const query = new URLSearchParams({
    profileId: params.profileId,
    accountId: params.accountId,
    platform: params.platform ?? "whatsapp"
  });
  if (params.status) query.set("status", params.status);
  if (params.sortOrder) query.set("sortOrder", params.sortOrder);
  if (typeof params.limit === "number") query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);

  return zernioFetch<{ data?: ZernioConversation[]; conversations?: ZernioConversation[] }>(`/v1/inbox/conversations?${query.toString()}`);
}

export async function getZernioConversation(conversationId: string, accountId: string) {
  return zernioFetch<{ data?: ZernioConversation; conversation?: ZernioConversation }>(
    `/v1/inbox/conversations/${encodeURIComponent(conversationId)}?accountId=${encodeURIComponent(accountId)}`
  );
}

export async function listZernioConversationMessages(conversationId: string, accountId: string) {
  return zernioFetch<{ data?: ZernioMessage[]; messages?: ZernioMessage[] }>(
    `/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages?accountId=${encodeURIComponent(accountId)}`
  );
}

export async function sendZernioConversationMessage(params: {
  conversationId: string;
  accountId: string;
  text?: string;
  attachments?: Array<{ url: string; mimeType?: string; filename?: string }>;
  template?: {
    name: string;
    language: string;
    components?: Array<Record<string, unknown>>;
  };
}) {
  return zernioFetch<{ data?: ZernioMessage; message?: ZernioMessage; id?: string }>(
    `/v1/inbox/conversations/${encodeURIComponent(params.conversationId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        accountId: params.accountId,
        ...(params.text ? { type: "text", text: { body: params.text } } : {}),
        ...(params.attachments?.length ? { type: "attachment", attachments: params.attachments } : {}),
        ...(params.template
          ? {
              type: "template",
              template: {
                name: params.template.name,
                language: params.template.language,
                components: params.template.components ?? []
              }
            }
          : {})
      })
    }
  );
}

export async function deleteZernioConversationMessage(conversationId: string, messageId: string, accountId: string) {
  return zernioFetch<{ ok: boolean }>(
    `/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}?accountId=${encodeURIComponent(accountId)}`,
    { method: "DELETE" }
  );
}
