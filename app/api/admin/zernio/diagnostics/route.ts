import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/multitenancy/tenant-context";
import { prisma } from "@/lib/prisma";
import { ensureTenantZernioChannel } from "@/server/services/zernio-sync-service";
import { listZernioConversations } from "@/lib/integrations/zernio/inbox";

export async function GET() {
  const ctx = await requireTenantContext();
  if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });

  const channel = await ensureTenantZernioChannel(ctx.tenantId);
  if (!channel.zernioAccountId || !channel.zernioProfileId) {
    return NextResponse.json(
      {
        data: {
          tenantId: ctx.tenantId,
          channel,
          inboxSupported: false,
          reason: "Missing resolved Zernio accountId/profileId"
        }
      },
      { status: 200 }
    );
  }

  let inboxConversationCount = 0;
  let inboxError: string | null = null;
  try {
    const inbox = await listZernioConversations({
      profileId: channel.zernioProfileId,
      accountId: channel.zernioAccountId,
      platform: "whatsapp",
      sortOrder: "desc",
      limit: 5
    });
    const conversations = inbox.data ?? inbox.conversations ?? [];
    inboxConversationCount = conversations.length;
  } catch (error) {
    inboxError = error instanceof Error ? error.message : "Unknown inbox error";
  }

  const recentWebhook = await prisma.webhookEvent.findFirst({
    where: { provider: "ZERNIO", externalChannelId: channel.whatsappAccountId },
    orderBy: { receivedAt: "desc" }
  });

  return NextResponse.json({
    data: {
      tenantId: ctx.tenantId,
      resolved: {
        profileId: channel.zernioProfileId,
        accountId: channel.zernioAccountId,
        whatsappAccountId: channel.whatsappAccountId,
        whatsappPhoneNumber: channel.whatsappPhoneNumber
      },
      inbox: {
        success: !inboxError,
        conversationCount: inboxConversationCount,
        error: inboxError
      },
      lastWebhook: recentWebhook
        ? {
            eventType: recentWebhook.eventType,
            processingStatus: recentWebhook.processingStatus,
            processingError: recentWebhook.processingError,
            receivedAt: recentWebhook.receivedAt
          }
        : null
    }
  });
}
