import "server-only";
import { zernioFetch, zernioRawFetch } from "@/lib/integrations/zernio/client";

export type ZernioAccount = {
  id: string;
  profileId?: string;
  platform?: string;
  providerAccountId?: string;
  displayName?: string;
  status?: string;
};

type ZernioAccountPayload = Omit<ZernioAccount, "id"> & {
  id?: string;
  _id?: string;
  accountId?: string;
};

function normalizeZernioAccounts(items: ZernioAccountPayload[] | undefined): ZernioAccount[] {
  return (items ?? []).flatMap((item) => {
    const id = item.id ?? item._id ?? item.accountId;
    return id ? [{ ...item, id }] : [];
  });
}

export type ZernioConversation = {
  id: string;
  accountId?: string;
  profileId?: string;
  platform?: string;
  participantId?: string;
  participantName?: string;
  participantPicture?: string;
  customer?: { id?: string; name?: string; phone?: string };
  participant?: { name?: string; phone?: string };
  lastMessage?: string | { id?: string; text?: string; body?: string; createdAt?: string; timestamp?: string };
  updatedTime?: string;
  updatedAt?: string;
  status?: string;
  unreadCount?: number;
};

export type ZernioMessage = {
  id: string;
  type?: string;
  direction?: "inbound" | "outbound" | string;
  status?: string;
  text?: { body?: string };
  message?: string;
  body?: string;
  createdAt?: string;
  timestamp?: string;
  sender?: { phone?: string; name?: string };
  deliveryStatus?: string;
  deliveredAt?: string;
  readAt?: string;
  sentAt?: string;
  attachments?: Array<{ id?: string; type?: string; url?: string; filename?: string; mimeType?: string; previewUrl?: string }>;
};

export async function listZernioAccounts(profileId: string, platform = "whatsapp") {
  const response = await zernioFetch<{ data?: ZernioAccountPayload[]; accounts?: ZernioAccountPayload[] }>(
    `/v1/accounts?profileId=${encodeURIComponent(profileId)}&platform=${encodeURIComponent(platform)}`
  );
  return {
    ...response,
    data: normalizeZernioAccounts(response.data),
    accounts: normalizeZernioAccounts(response.accounts)
  };
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

  return zernioFetch<{
    data?: ZernioConversation[];
    conversations?: ZernioConversation[];
    pagination?: { hasMore?: boolean; nextCursor?: string };
  }>(`/v1/inbox/conversations?${query.toString()}`);
}

export async function getZernioConversation(conversationId: string, accountId: string) {
  return zernioFetch<{ data?: ZernioConversation; conversation?: ZernioConversation }>(
    `/v1/inbox/conversations/${encodeURIComponent(conversationId)}?accountId=${encodeURIComponent(accountId)}`
  );
}

export async function listZernioConversationMessages(conversationId: string, accountId: string, cursor?: string) {
  const query = new URLSearchParams({ accountId, limit: "100", sortOrder: "asc" });
  if (cursor) query.set("cursor", cursor);
  return zernioFetch<{ data?: ZernioMessage[]; messages?: ZernioMessage[]; pagination?: { hasMore?: boolean; nextCursor?: string } }>(
    `/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages?${query.toString()}`
  );
}

export async function sendZernioConversationMessage(params: {
  conversationId: string;
  accountId: string;
  text?: string;
  attachment?: { url: string; type?: "image" | "video" | "audio" | "file"; filename?: string };
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
        ...(params.text ? { message: params.text } : {}),
        ...(params.attachment
          ? {
              attachmentUrl: params.attachment.url,
              attachmentType: params.attachment.type ?? "file",
              ...(params.attachment.filename ? { attachmentName: params.attachment.filename } : {})
            }
          : {}),
        ...(params.template
          ? {
              template: {
                elements: [{
                  name: params.template.name,
                  language: params.template.language,
                  components: params.template.components ?? []
                }]
              }
            }
          : {})
      })
    }
  );
}

export async function createZernioWhatsappConversation(params: {
  accountId: string;
  phoneNumber: string;
  templateName: string;
  templateLanguage: string;
  templateParams?: string[];
}) {
  return zernioFetch<{
    success?: boolean;
    data?: { messageId?: string; conversationId?: string; participantId?: string; participantName?: string };
  }>("/v1/inbox/conversations", {
    method: "POST",
    body: JSON.stringify({
      accountId: params.accountId,
      participantId: params.phoneNumber.replace(/[^\d]/g, ""),
      templateName: params.templateName,
      templateLanguage: params.templateLanguage,
      templateParams: params.templateParams ?? []
    })
  });
}

export async function uploadZernioMedia(file: File) {
  const form = new FormData();
  form.append("file", file, file.name);
  if (file.type) form.append("contentType", file.type);
  return zernioFetch<{ url: string; filename?: string; contentType?: string; size?: number }>("/v1/media/upload-direct", {
    method: "POST",
    body: form
  });
}

export function downloadZernioWhatsappMedia(mediaId: string, accountId: string) {
  return zernioRawFetch(`/v1/whatsapp/media/${encodeURIComponent(mediaId)}?accountId=${encodeURIComponent(accountId)}`);
}

export async function deleteZernioConversationMessage(conversationId: string, messageId: string, accountId: string) {
  return zernioFetch<{ ok: boolean }>(
    `/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}?accountId=${encodeURIComponent(accountId)}`,
    { method: "DELETE" }
  );
}
