import "server-only";
import { prisma } from "@/lib/prisma";
import {
  getZernioConversation,
  createZernioWhatsappConversation,
  listZernioAccounts,
  listZernioConversationMessages,
  listZernioConversations,
  listZernioPhoneNumbers,
  sendZernioConversationMessage,
  type ZernioConversation,
  type ZernioMessage
} from "@/lib/integrations/zernio/inbox";
import { isWithinWhatsappServiceWindow } from "@/lib/integrations/zernio/message-window-utils";

function normalizePhoneNumber(value?: string | null) {
  if (!value) return "";
  return value.replace(/[^\d+]/g, "");
}

function pickResolvedWhatsappAccount(params: {
  accounts: Array<{ id?: string; platform?: string; status?: string; username?: string }>;
  existingAccountId?: string | null;
  existingWhatsappAccountId?: string | null;
  phoneNumbers: Array<{ accountId?: string; phoneNumber?: string; displayNumber?: string }>;
  existingWhatsappPhone?: string | null;
}) {
  const accounts = params.accounts.filter((item): item is { id: string; platform?: string; status?: string; username?: string } => Boolean(item?.id));
  if (accounts.length === 0) return null;

  const existingAccountId = params.existingAccountId ?? params.existingWhatsappAccountId;
  if (existingAccountId) {
    const matched = accounts.find((item) => item.id === existingAccountId);
    if (matched) return matched;
  }

  const expectedPhone = normalizePhoneNumber(params.existingWhatsappPhone);
  if (expectedPhone) {
    const matchedPhone = params.phoneNumbers.find((item) => {
      if (!item.accountId) return false;
      const phone = normalizePhoneNumber(item.displayNumber ?? item.phoneNumber);
      return phone === expectedPhone;
    });
    if (matchedPhone?.accountId) {
      const matched = accounts.find((item) => item.id === matchedPhone.accountId);
      if (matched) return matched;
    }
  }

  const connected = accounts.filter((item) =>
    (item.platform ?? "whatsapp").toLowerCase() === "whatsapp" &&
    ["connected", "active", "ready", "verified", "approved"].includes((item.status ?? "connected").toLowerCase())
  );
  return connected.length === 1 ? connected[0] : null;
}

function getConversationParticipant(conversation: ZernioConversation) {
  return {
    name: conversation.participantName ?? conversation.customer?.name ?? conversation.participant?.name ?? "Unknown",
    phone: conversation.participantId ?? conversation.customer?.phone ?? conversation.participant?.phone ?? ""
  };
}

function getMessageBody(message: ZernioMessage) {
  return message.message ?? message.text?.body ?? message.body ?? "";
}

function mapStatus(status?: string) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "read") return "READ" as const;
  if (normalized === "delivered") return "DELIVERED" as const;
  if (normalized === "failed") return "FAILED" as const;
  if (normalized === "sent") return "SENT" as const;
  return "QUEUED" as const;
}

export async function ensureTenantZernioChannel(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant not found");

  const existing = await prisma.tenantMessagingChannel.findFirst({ where: { tenantId, provider: "ZERNIO" } });
  const profileId = existing?.zernioProfileId;
  if (!profileId) throw new Error("No Zernio profile configured for tenant");

  const accountsResponse = await listZernioAccounts(profileId, "whatsapp");
  const accounts = accountsResponse.data ?? accountsResponse.accounts ?? [];
  const phoneResponse = await listZernioPhoneNumbers();
  const phoneNumbers = phoneResponse.data ?? [];
  const resolvedAccount = pickResolvedWhatsappAccount({
    accounts,
    existingAccountId: existing?.zernioAccountId,
    existingWhatsappAccountId: existing?.whatsappAccountId,
    phoneNumbers,
    existingWhatsappPhone: existing?.whatsappPhoneNumber
  });
  if (!resolvedAccount?.id) {
    console.error("[ZERNIO_SYNC] Failed to resolve WhatsApp account", {
      tenantId,
      tenantName: tenant.name,
      profileId,
      accountsCount: accounts.length
    });
    throw new Error(accounts.length > 1
      ? "Multiple WhatsApp accounts are connected to this Zernio profile; select the account in System Admin"
      : "No connected WhatsApp account was found for this Zernio profile");
  }

  const phone = phoneNumbers.find((item) => item.accountId === resolvedAccount.id);
  console.info("[ZERNIO_SYNC] Resolved WhatsApp account", {
    tenantId,
    tenantName: tenant.name,
    profileId,
    accountId: resolvedAccount.id,
    platform: resolvedAccount.platform ?? "unknown",
    phoneNumber: phone?.displayNumber ?? phone?.phoneNumber ?? resolvedAccount.username ?? existing?.whatsappPhoneNumber ?? ""
  });

  return prisma.tenantMessagingChannel.upsert({
    where: { tenantId_provider: { tenantId, provider: "ZERNIO" } },
    update: {
      zernioProfileId: profileId,
      zernioAccountId: resolvedAccount.id,
      whatsappAccountId: resolvedAccount.id,
      zernioPhoneNumberId: phone?.id,
      whatsappPhoneNumber: phone?.displayNumber ?? phone?.phoneNumber ?? resolvedAccount.username ?? existing?.whatsappPhoneNumber ?? "",
      displayName: existing?.displayName ?? "WhatsApp (ZERNIO)",
      connectionStatus: "CONNECTED",
      isActive: true
    },
    create: {
      tenantId,
      provider: "ZERNIO",
      zernioProfileId: profileId,
      zernioAccountId: resolvedAccount.id,
      whatsappAccountId: resolvedAccount.id,
      zernioPhoneNumberId: phone?.id,
      whatsappPhoneNumber: phone?.displayNumber ?? phone?.phoneNumber ?? resolvedAccount.username ?? "",
      displayName: "WhatsApp (ZERNIO)",
      connectionStatus: "CONNECTED",
      isActive: true
    }
  });
}

export async function syncConversationFromZernio(tenantId: string, conversationId: string) {
  const channel = await ensureTenantZernioChannel(tenantId);
  if (!channel.zernioAccountId) throw new Error("Missing Zernio account ID");

  console.info("[ZERNIO_SYNC] Syncing conversation", {
    tenantId,
    conversationId,
    accountId: channel.zernioAccountId
  });

  const detail = await getZernioConversation(conversationId, channel.zernioAccountId);
  const conversation = detail.data ?? detail.conversation;
  if (!conversation) throw new Error("Conversation not found");

  const participant = getConversationParticipant(conversation);
  const conversationUpdatedAt = new Date(conversation.updatedTime ?? conversation.updatedAt ?? Date.now());
  const customer = await prisma.customer.upsert({
    where: { tenantId_phoneNumber: { tenantId, phoneNumber: participant.phone || `unknown-${conversation.id}` } },
    update: { fullName: participant.name, firstName: participant.name.split(" ")[0] ?? participant.name, lastName: "" },
    create: {
      tenantId,
      phoneNumber: participant.phone || `unknown-${conversation.id}`,
      fullName: participant.name,
      firstName: participant.name.split(" ")[0] ?? participant.name,
      lastName: ""
    }
  });

  const existingContactThread = await prisma.conversationThread.findFirst({
    where: { tenantId, customerId: customer.id },
    orderBy: { updatedAt: "desc" }
  });
  const thread = existingContactThread
    ? await prisma.conversationThread.update({
        where: { id: existingContactThread.id },
        data: {
          externalConversationId: conversation.id,
          whatsappAccountId: channel.whatsappAccountId,
          customerId: customer.id,
          phoneNumber: customer.phoneNumber,
          unreadCount: conversation.unreadCount ?? 0,
          lastMessageAt: conversationUpdatedAt
        }
      })
    : await prisma.conversationThread.create({
      data: {
        tenantId,
        customerId: customer.id,
        whatsappAccountId: channel.whatsappAccountId,
        externalConversationId: conversation.id,
        phoneNumber: customer.phoneNumber,
        unreadCount: conversation.unreadCount ?? 0,
        lastMessageAt: conversationUpdatedAt
      }
    });

  const messages: ZernioMessage[] = [];
  let messageCursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const msgResponse = await listZernioConversationMessages(conversation.id, channel.zernioAccountId, messageCursor);
    messages.push(...(msgResponse.data ?? msgResponse.messages ?? []));
    if (!msgResponse.pagination?.hasMore || !msgResponse.pagination.nextCursor) break;
    messageCursor = msgResponse.pagination.nextCursor;
  }
  console.info("[ZERNIO_SYNC] Conversation message fetch complete", {
    tenantId,
    conversationId: conversation.id,
    messageCount: messages.length
  });

  for (const message of messages) {
    const body = getMessageBody(message);
    await prisma.message.upsert({
      where: { tenantId_externalMessageId: { tenantId, externalMessageId: message.id } },
      update: {
        body,
        type: message.type ?? "TEXT",
        status: mapStatus(message.deliveryStatus ?? message.status),
        rawPayload: message,
        deliveredAt: message.deliveredAt ? new Date(message.deliveredAt) : undefined,
        readAt: message.readAt ? new Date(message.readAt) : undefined
      },
      create: {
        tenantId,
        threadId: thread.id,
        customerId: customer.id,
        direction: ["outbound", "outgoing"].includes((message.direction ?? "incoming").toLowerCase()) ? "OUTBOUND" : "INBOUND",
        type: message.type ?? "TEXT",
        body,
        status: mapStatus(message.deliveryStatus ?? message.status),
        externalMessageId: message.id,
        receivedAt: ["inbound", "incoming"].includes((message.direction ?? "incoming").toLowerCase()) ? new Date(message.timestamp ?? message.createdAt ?? Date.now()) : null,
        sentAt: ["outbound", "outgoing"].includes((message.direction ?? "incoming").toLowerCase()) ? new Date(message.sentAt ?? message.timestamp ?? message.createdAt ?? Date.now()) : null,
        rawPayload: message
      }
    });
  }

  return thread;
}

export async function syncTenantConversations(tenantId: string) {
  const channel = await ensureTenantZernioChannel(tenantId);
  if (!channel.zernioAccountId || !channel.zernioProfileId) throw new Error("Missing Zernio channel IDs");

  const conversations: ZernioConversation[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const response = await listZernioConversations({
      profileId: channel.zernioProfileId,
      accountId: channel.zernioAccountId,
      platform: "whatsapp",
      sortOrder: "desc",
      limit: 100,
      cursor
    });
    conversations.push(...(response.data ?? response.conversations ?? []));
    const pagination = (response as { pagination?: { hasMore?: boolean; nextCursor?: string } }).pagination;
    if (!pagination?.hasMore || !pagination.nextCursor) break;
    cursor = pagination.nextCursor;
  }
  console.info("[ZERNIO_SYNC] Inbox conversations fetched", {
    tenantId,
    profileId: channel.zernioProfileId,
    accountId: channel.zernioAccountId,
    platform: "whatsapp",
    conversationCount: conversations.length
  });
  if (conversations.length === 0) {
    console.warn("[ZERNIO_SYNC] Inbox returned no conversations", {
      tenantId,
      profileId: channel.zernioProfileId,
      accountId: channel.zernioAccountId,
      diagnostic: "Verify WhatsApp Inbox add-on/capability for the account"
    });
  }
  for (const conversation of conversations) {
    await syncConversationFromZernio(tenantId, conversation.id);
  }

  return prisma.conversationThread.findMany({
    where: { tenantId },
    include: {
      customer: true,
      workItem: true,
      messages: { orderBy: { createdAt: "asc" } }
    },
    orderBy: { lastMessageAt: "desc" }
  });
}

export async function sendConversationMessage(params: {
  tenantId: string;
  threadId: string;
  phoneNumber?: string;
  text?: string;
  attachments?: Array<{ url: string; mimeType?: string; filename?: string }>;
  template?: { name: string; language: string; components?: Array<Record<string, unknown>> };
}) {
  const channel = await ensureTenantZernioChannel(params.tenantId);
  let thread = await prisma.conversationThread.findFirst({ where: { id: params.threadId, tenantId: params.tenantId } });
  if (!thread && params.phoneNumber) {
    const customer = await prisma.customer.findUnique({
      where: { tenantId_phoneNumber: { tenantId: params.tenantId, phoneNumber: params.phoneNumber } }
    });
    if (customer) {
      thread = await prisma.conversationThread.findFirst({
        where: { tenantId: params.tenantId, customerId: customer.id },
        orderBy: { updatedAt: "desc" }
      });
    }
  }
  if (!channel.zernioAccountId) throw new Error("No Zernio account is configured for this tenant");

  if (!thread?.externalConversationId) {
    if (!params.template || !params.phoneNumber) throw new Error("WHATSAPP_TEMPLATE_REQUIRED");
    const templateParams = (params.template.components ?? []).flatMap((component) => {
      const parameters = component.parameters;
      return Array.isArray(parameters)
        ? parameters.flatMap((parameter) => parameter && typeof parameter === "object" && "text" in parameter ? [String(parameter.text)] : [])
        : [];
    });
    const created = await createZernioWhatsappConversation({
      accountId: channel.zernioAccountId,
      phoneNumber: params.phoneNumber,
      templateName: params.template.name,
      templateLanguage: params.template.language,
      templateParams
    });
    const conversationId = created.data?.conversationId;
    if (!conversationId) throw new Error("Zernio did not return a conversation ID");
    await syncConversationFromZernio(params.tenantId, conversationId);
    return created;
  }

  if (params.text) {
    const lastInbound = await prisma.message.findFirst({
      where: { threadId: thread.id, direction: "INBOUND" },
      orderBy: { receivedAt: "desc" }
    });
    if (lastInbound?.receivedAt && !isWithinWhatsappServiceWindow(lastInbound.receivedAt) && !params.template) {
      throw new Error("WHATSAPP_TEMPLATE_REQUIRED");
    }
  }

  const result = await sendZernioConversationMessage({
    conversationId: thread.externalConversationId,
    accountId: channel.zernioAccountId,
    text: params.text,
    attachment: params.attachments?.[0]
      ? {
          url: params.attachments[0].url,
          type: params.attachments[0].mimeType?.startsWith("image/") ? "image"
            : params.attachments[0].mimeType?.startsWith("video/") ? "video"
              : params.attachments[0].mimeType?.startsWith("audio/") ? "audio" : "file",
          filename: params.attachments[0].filename
        }
      : undefined,
    template: params.template
  });

  await syncConversationFromZernio(params.tenantId, thread.externalConversationId);
  return result;
}
