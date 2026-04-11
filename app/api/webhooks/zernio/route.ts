import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantByWhatsappAccount } from "@/server/services/tenant-channel-service";
import { normalizeToE164 } from "@/lib/phone/normalize";
import { normalizeZernioWebhookEvent } from "@/lib/integrations/zernio/webhooks";
import { mapZernioWebhookToInboundMessage } from "@/lib/integrations/zernio/webhook-mapper";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const eventType = payload?.type ?? "unknown";
  const whatsappAccountId = payload?.accountId as string | undefined;
  const externalMessageId = (payload?.message?.id ?? payload?.messageId) as string | undefined;

  const event = await prisma.webhookEvent.create({
    data: {
      provider: "ZERNIO",
      eventType,
      externalChannelId: whatsappAccountId,
      externalMessageId,
      payload,
      processingStatus: "RECEIVED"
    }
  });

  try {
    if (!whatsappAccountId) throw new Error("Missing accountId");
    const channel = await resolveTenantByWhatsappAccount(whatsappAccountId);
    if (!channel?.tenantId) throw new Error("Unknown account");

    const tenantId = channel.tenantId;
    const normalized = normalizeZernioWebhookEvent(payload, tenantId);
    const inboundMessage = mapZernioWebhookToInboundMessage(normalized);

    if (normalized.messageId) {
      const existingMessage = await prisma.message.findFirst({
        where: { tenantId, externalMessageId: normalized.messageId }
      });
      if (existingMessage) {
        await prisma.webhookEvent.update({
          where: { id: event.id },
          data: { tenantId, processingStatus: "PROCESSED", processedAt: new Date() }
        });
        return NextResponse.json({ ok: true, deduplicated: true });
      }
    }

    if (eventType === "account.connected" || eventType === "account.disconnected") {
      await prisma.tenantMessagingChannel.update({
        where: { id: channel.id },
        data: { connectionStatus: eventType === "account.connected" ? "CONNECTED" : "DISCONNECTED" }
      });

      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { tenantId, processingStatus: "PROCESSED", processedAt: new Date() }
      });
      return NextResponse.json({ ok: true });
    }

    if (eventType !== "message.received") throw new Error(`Unsupported event type: ${eventType}`);

    const phone = normalizeToE164(normalized.sender ?? "");
    if (!phone) throw new Error("Missing sender phone");

    const existingCustomer = await prisma.customer.findFirst({ where: { tenantId, phoneNumber: phone } });

    const customer =
      existingCustomer ??
      (await prisma.customer.create({
        data: {
          tenantId,
          firstName: payload?.contact?.name ?? "Unknown",
          lastName: "",
          fullName: payload?.contact?.name ?? "Unknown",
          phoneNumber: phone
        }
      }));

    const existingThread = normalized.conversationId
      ? await prisma.conversationThread.findFirst({
          where: { tenantId, whatsappAccountId, externalConversationId: normalized.conversationId }
        })
      : null;

    const thread =
      existingThread ??
      (await prisma.conversationThread.create({
        data: {
          tenantId,
          customerId: customer.id,
          whatsappAccountId,
          phoneNumber: phone,
          externalConversationId: normalized.conversationId,
          unreadCount: 0,
          lastMessageAt: new Date()
        }
      }));

    await prisma.conversationThread.update({
      where: { id: thread.id },
      data: {
        unreadCount: { increment: 1 },
        lastMessageAt: new Date()
      }
    });

    await prisma.message.create({
      data: {
        tenantId,
        threadId: thread.id,
        customerId: customer.id,
        direction: "INBOUND",
        type: normalized.type,
        body: normalized.body ?? "",
        status: "DELIVERED",
        externalMessageId: normalized.messageId,
        receivedAt: new Date(normalized.timestamp),
        rawPayload: normalized
      }
    });

    console.info("[workflow-button-reply] Inbound message normalized for provider-agnostic matcher.", {
      tenantId: inboundMessage.tenantId,
      provider: inboundMessage.provider,
      accountId: inboundMessage.accountId,
      profileId: inboundMessage.profileId,
      phoneNumberId: inboundMessage.phoneNumberId,
      conversationId: inboundMessage.conversationId,
      messageId: inboundMessage.messageId,
      normalizedText: inboundMessage.messageTextNormalized
    });

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { tenantId, processingStatus: "PROCESSED", processedAt: new Date() }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { processingStatus: "FAILED", processingError: error instanceof Error ? error.message : "unknown" }
    });
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
