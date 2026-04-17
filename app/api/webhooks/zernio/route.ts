import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantByWhatsappAccount } from "@/server/services/tenant-channel-service";
import { syncConversationFromZernio } from "@/server/services/zernio-sync-service";

const SUPPORTED_EVENTS = new Set([
  "message.received",
  "message.sent",
  "message.delivered",
  "message.read",
  "message.failed",
  "message.deleted",
  "account.connected",
  "account.disconnected"
]);

function isSignatureValid(rawBody: string, signature: string | null) {
  const secret = process.env.ZERNIO_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-Zernio-Signature");
  if (!isSignatureValid(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody || "{}");
  const eventType = payload?.type ?? "unknown";
  if (!SUPPORTED_EVENTS.has(eventType)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const whatsappAccountId = (payload?.accountId ?? payload?.account?.id) as string | undefined;
  const eventId = (payload?.id ?? payload?.eventId ?? payload?.webhookId) as string | undefined;
  const eventUniqueId = eventId ?? `${eventType}:${payload?.message?.id ?? payload?.messageId ?? "no-message"}`;

  const existingEvent = await prisma.webhookEvent.findFirst({
    where: { provider: "ZERNIO", eventType, externalMessageId: eventUniqueId }
  });
  if (existingEvent) return NextResponse.json({ ok: true, deduplicated: true });

  const event = await prisma.webhookEvent.create({
    data: {
      provider: "ZERNIO",
      eventType,
      externalChannelId: whatsappAccountId,
      externalMessageId: eventUniqueId,
      payload,
      processingStatus: "RECEIVED"
    }
  });

  if (!whatsappAccountId) {
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processingStatus: "FAILED", processingError: "Missing accountId" } });
    return NextResponse.json({ ok: true });
  }

  const channel = await resolveTenantByWhatsappAccount(whatsappAccountId);
  if (!channel?.tenantId) {
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processingStatus: "FAILED", processingError: "Unknown account" } });
    return NextResponse.json({ ok: true });
  }

  const tenantId = channel.tenantId;

  if (eventType === "account.connected" || eventType === "account.disconnected") {
    await prisma.tenantMessagingChannel.update({
      where: { id: channel.id },
      data: { connectionStatus: eventType === "account.connected" ? "CONNECTED" : "DISCONNECTED" }
    });
  }

  const conversationId = payload?.message?.conversationId ?? payload?.conversationId;
  if (conversationId && eventType.startsWith("message.")) {
    try {
      await syncConversationFromZernio(tenantId, conversationId);
    } catch (error) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { tenantId, processingStatus: "FAILED", processingError: error instanceof Error ? error.message : "sync failed" }
      });
      return NextResponse.json({ ok: true });
    }
  }

  await prisma.webhookEvent.update({
    where: { id: event.id },
    data: { tenantId, processingStatus: "PROCESSED", processedAt: new Date() }
  });

  return NextResponse.json({ ok: true });
}
