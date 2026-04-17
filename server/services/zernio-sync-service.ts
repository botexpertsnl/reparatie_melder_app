import "server-only";
import { prisma } from "@/lib/prisma";
import {
  getZernioConversation,
  listZernioAccounts,
  listZernioConversationMessages,
  listZernioConversations,
  listZernioPhoneNumbers,
  sendZernioConversationMessage,
  type ZernioConversation,
  type ZernioMessage
} from "@/lib/integrations/zernio/inbox";
import { isWithinWhatsappServiceWindow } from "@/lib/integrations/zernio/message-window-utils";

const DEFAULT_PROFILE_ID = "69dac091b54d90f7e8780d93";
const DEFAULT_AUTOGARAGE_PHONE = "+18054670673";

function normalizePhoneNumber(value?: string | null) {
  if (!value) return "";
  return value.replace(/[^\d+]/g, "");
}

function pickResolvedWhatsappAccount(params: {
  accounts: Array<{ id?: string; platform?: string; status?: string }>;
  existingAccountId?: string | null;
  existingWhatsappAccountId?: string | null;
  phoneNumbers: Array<{ accountId?: string; phoneNumber?: string; displayNumber?: string }>;
  existingWhatsappPhone?: string | null;
}) {
  const accounts = params.accounts.filter((item): item is { id: string; platform?: string; status?: string } => Boolean(item?.id));
  if (accounts.length === 0) return null;

  const existingAccountId = params.existingAccountId ?? params.existingWhatsappAccountId;
  if (existingAccountId) {
    const matched = accounts.find((item) => item.id === existingAccountId);
    if (matched) return matched;
  }

  const expectedPhone = normalizePhoneNumber(params.existingWhatsappPhone) || DEFAULT_AUTOGARAGE_PHONE;
  const matchedPhone = params.phoneNumbers.find((item) => {
    if (!item.accountId) return false;
    const phone = normalizePhoneNumber(item.displayNumber ?? item.phoneNumber);
    return phone === normalizePhoneNumber(expectedPhone);
  });
  if (matchedPhone?.accountId) {
    const matched = accounts.find((item) => item.id === matchedPhone.accountId);
    if (matched) return matched;
  }

  return (
    accounts.find((item) => (item.platform ?? "").toLowerCase() === "whatsapp" && (item.status ?? "").toLowerCase() === "connected") ??
    accounts.find((item) => (item.platform ?? "").toLowerCase() === "whatsapp") ??
    accounts[0]
  );
}

function getConversationParticipant(conversation: ZernioConversation) {
  return {
    name: conversation.customer?.name ?? conversation.participant?.name ?? "Unknown",
    phone: conversation.customer?.phone ?? conversation.participant?.phone ?? ""
  };
}

function getMessageBody(message: ZernioMessage) {
  return message.text?.body ?? message.body ?? "";
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
  const profileId = existing?.zernioProfileId ?? (tenant.name === "AutoGarage De Vries" ? DEFAULT_PROFILE_ID : null);
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
    throw new Error("No WhatsApp account connected in Zernio");
  }

  const phone = phoneNumbers.find((item) => item.accountId === resolvedAccount.id);
  console.info("[ZERNIO_SYNC] Resolved WhatsApp account", {
    tenantId,
    tenantName: tenant.name,
    profileId,
    accountId: resolvedAccount.id,
    platform: resolvedAccount.platform ?? "unknown",
    phoneNumber: phone?.displayNumber ?? phone?.phoneNumber ?? existing?.whatsappPhoneNumber ?? DEFAULT_AUTOGARAGE_PHONE
  });

  return prisma.tenantMessagingChannel.upsert({
    where: { tenantId_provider: { tenantId, provider: "ZERNIO" } },
    update: {
      zernioProfileId: profileId,
      zernioAccountId: resolvedAccount.id,
      whatsappAccountId: resolvedAccount.id,
      zernioPhoneNumberId: phone?.id,
      whatsappPhoneNumber: phone?.displayNumber ?? phone?.phoneNumber ?? existing?.whatsappPhoneNumber ?? DEFAULT_AUTOGARAGE_PHONE,
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
      whatsappPhoneNumber: phone?.displayNumber ?? phone?.phoneNumber ?? DEFAULT_AUTOGARAGE_PHONE,
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

  const thread = await prisma.conversationThread.upsert({
    where: {
      tenantId_whatsappAccountId_externalConversationId: {
        tenantId,
        whatsappAccountId: channel.whatsappAccountId,
        externalConversationId: conversation.id
      }
    },
    update: {
      customerId: customer.id,
      phoneNumber: customer.phoneNumber,
      lastMessageAt: conversation.updatedAt ? new Date(conversation.updatedAt) : new Date()
    },
    create: {
      tenantId,
      customerId: customer.id,
      whatsappAccountId: channel.whatsappAccountId,
      externalConversationId: conversation.id,
      phoneNumber: customer.phoneNumber,
      lastMessageAt: conversation.updatedAt ? new Date(conversation.updatedAt) : new Date()
    }
  });

  const msgResponse = await listZernioConversationMessages(conversation.id, channel.zernioAccountId);
  const messages = msgResponse.data ?? msgResponse.messages ?? [];
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
        status: mapStatus(message.status),
        rawPayload: message,
        deliveredAt: message.status === "delivered" ? new Date(message.timestamp ?? message.createdAt ?? Date.now()) : undefined,
        readAt: message.status === "read" ? new Date(message.timestamp ?? message.createdAt ?? Date.now()) : undefined
      },
      create: {
        tenantId,
        threadId: thread.id,
        customerId: customer.id,
        direction: (message.direction ?? "inbound").toLowerCase() === "outbound" ? "OUTBOUND" : "INBOUND",
        type: message.type ?? "TEXT",
        body,
        status: mapStatus(message.status),
        externalMessageId: message.id,
        receivedAt: (message.direction ?? "inbound").toLowerCase() === "inbound" ? new Date(message.timestamp ?? message.createdAt ?? Date.now()) : null,
        sentAt: (message.direction ?? "inbound").toLowerCase() === "outbound" ? new Date(message.timestamp ?? message.createdAt ?? Date.now()) : null,
        rawPayload: message
      }
    });
  }

  return thread;
}

export async function syncTenantConversations(tenantId: string) {
  const channel = await ensureTenantZernioChannel(tenantId);
  if (!channel.zernioAccountId || !channel.zernioProfileId) throw new Error("Missing Zernio channel IDs");

  const response = await listZernioConversations({
    profileId: channel.zernioProfileId,
    accountId: channel.zernioAccountId,
    platform: "whatsapp",
    sortOrder: "desc",
    limit: 50
  });

  const conversations = response.data ?? response.conversations ?? [];
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
  text?: string;
  attachments?: Array<{ url: string; mimeType?: string; filename?: string }>;
  template?: { name: string; language: string; components?: Array<Record<string, unknown>> };
}) {
  const channel = await ensureTenantZernioChannel(params.tenantId);
  const thread = await prisma.conversationThread.findFirst({ where: { id: params.threadId, tenantId: params.tenantId } });
  if (!thread?.externalConversationId || !channel.zernioAccountId) throw new Error("Thread is not linked to Zernio conversation");

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
    attachments: params.attachments,
    template: params.template
  });

  await syncConversationFromZernio(params.tenantId, thread.externalConversationId);
  return result;
}
