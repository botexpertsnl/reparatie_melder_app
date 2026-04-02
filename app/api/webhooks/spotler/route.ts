import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { resolveTenantByExternalChannel } from "@/server/services/tenant-channel-service";
import { normalizeToE164 } from "@/lib/phone/normalize";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const eventType = payload?.event_type ?? "unknown";
  const externalChannelId = payload?.channel_id as string | undefined;
  const externalMessageId = payload?.message_id as string | undefined;

  const event = await prisma.webhookEvent.create({
    data: {
      provider: "SPOTLER",
      eventType,
      externalChannelId,
      externalMessageId,
      payload,
      processingStatus: "RECEIVED"
    }
  });

  try {
    if (!externalChannelId) throw new Error("Missing channel_id");
    const channel = await resolveTenantByExternalChannel(externalChannelId);
    if (!channel?.tenantId) throw new Error("Unknown channel");

    const tenantId = channel.tenantId;
    const phone = normalizeToE164(payload?.from ?? payload?.contact?.phone ?? "");
    if (!phone) throw new Error("Missing sender phone");

    if (externalMessageId) {
      const existingMessage = await prisma.message.findFirst({
        where: { tenantId, externalMessageId }
      });
      if (existingMessage) {
        await prisma.webhookEvent.update({
          where: { id: event.id },
          data: { tenantId, processingStatus: "PROCESSED", processedAt: new Date() }
        });
        return NextResponse.json({ ok: true, deduplicated: true });
      }
    }

    const existingCustomer = await prisma.customer.findFirst({
      where: { tenantId, phoneNumber: phone }
    });

    const customer = existingCustomer
      ? existingCustomer
      : await prisma.customer.create({
          data: {
            tenantId,
            firstName: payload?.contact?.name ?? "Unknown",
            lastName: "",
            fullName: payload?.contact?.name ?? "Unknown",
            phoneNumber: phone
          }
        });

    const externalConversationId = payload?.thread_id as string | undefined;
    const existingThread = externalConversationId
      ? await prisma.conversationThread.findFirst({
          where: { tenantId, externalChannelId, externalConversationId }
        })
      : null;

    const thread = existingThread
      ? await prisma.conversationThread.update({
          where: { id: existingThread.id },
          data: { unreadCount: { increment: 1 }, lastMessageAt: new Date() }
        })
      : await prisma.conversationThread.create({
          data: {
            tenantId,
            customerId: customer.id,
            externalChannelId,
            phoneNumber: phone,
            externalConversationId,
            unreadCount: 1,
            lastMessageAt: new Date()
          }
        });

    await prisma.message.create({
      data: {
        tenantId,
        threadId: thread.id,
        customerId: customer.id,
        direction: "INBOUND",
        type: payload?.type ?? "TEXT",
        body: payload?.text?.body ?? payload?.body ?? "",
        status: "DELIVERED",
        externalMessageId,
        receivedAt: new Date(),
        rawPayload: payload
      }
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
