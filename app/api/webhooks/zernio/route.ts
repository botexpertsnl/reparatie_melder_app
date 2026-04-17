import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

function resolveEventType(payload: Record<string, unknown>) {
  const type = payload?.type;
  if (typeof type === "string" && type.length > 0) return type;
  const event = payload?.event;
  if (typeof event === "string" && event.length > 0) return event;
  return "unknown";
}

function resolveWebhookAccountId(payload: Record<string, unknown>) {
  const accountId =
    payload?.accountId ??
    (payload?.account as { id?: string } | undefined)?.id ??
    (payload?.message as { accountId?: string } | undefined)?.accountId;
  return typeof accountId === "string" ? accountId : undefined;
}

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
    console.warn("[ZERNIO_WEBHOOK] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody || "{}") as Record<string, unknown>;
  const eventType = resolveEventType(payload);
  const whatsappAccountId = resolveWebhookAccountId(payload);
  const conversationId = (
    (payload?.message as { conversationId?: string } | undefined)?.conversationId ??
    payload?.conversationId
  ) as string | undefined;
  const messageId = ((payload?.message as { id?: string } | undefined)?.id ?? payload?.messageId) as string | undefined;

  console.info("[ZERNIO_WEBHOOK] Received", {
    eventType,
    accountId: whatsappAccountId ?? null,
    conversationId: conversationId ?? null,
    messageId: messageId ?? null
  });

  if (!SUPPORTED_EVENTS.has(eventType)) {
    console.info("[ZERNIO_WEBHOOK] Ignored unsupported event", { eventType });
    return NextResponse.json({ ok: true, ignored: true });
  }

  const eventId = (payload?.id ?? payload?.eventId ?? payload?.webhookId) as string | undefined;
  const eventUniqueId = eventId ?? `${eventType}:${messageId ?? "no-message"}`;

  const existingEvent = await prisma.webhookEvent.findFirst({
    where: { provider: "ZERNIO", eventType, externalMessageId: eventUniqueId }
  });
  if (existingEvent) {
    console.info("[ZERNIO_WEBHOOK] Deduplicated event", { eventType, eventUniqueId });
    return NextResponse.json({ ok: true, deduplicated: true });
  }

  const event = await prisma.webhookEvent.create({
    data: {
      provider: "ZERNIO",
      eventType,
      externalChannelId: whatsappAccountId,
      externalMessageId: eventUniqueId,
      payload: payload as Prisma.InputJsonValue,
      processingStatus: "RECEIVED"
    }
  });

  if (!whatsappAccountId) {
    console.error("[ZERNIO_WEBHOOK] Missing accountId", { eventType, eventUniqueId });
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processingStatus: "FAILED", processingError: "Missing accountId" } });
    return NextResponse.json({ ok: true });
  }

  const channel = await resolveTenantByWhatsappAccount(whatsappAccountId);
  if (!channel?.tenantId) {
    console.error("[ZERNIO_WEBHOOK] Unknown account", { eventType, whatsappAccountId, eventUniqueId });
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

  if (eventType.startsWith("message.")) {
    try {
      if (conversationId) {
        await syncConversationFromZernio(tenantId, conversationId);
        console.info("[ZERNIO_WEBHOOK] Canonical refresh completed", {
          tenantId,
          accountId: whatsappAccountId,
          conversationId,
          eventType
        });
      } else {
        const { syncTenantConversations } = await import("@/server/services/zernio-sync-service");
        await syncTenantConversations(tenantId);
        console.info("[ZERNIO_WEBHOOK] Canonical full inbox refresh completed (missing conversationId)", {
          tenantId,
          accountId: whatsappAccountId,
          eventType
        });
      }
    } catch (error) {
      console.error("[ZERNIO_WEBHOOK] Canonical refresh failed", {
        tenantId,
        accountId: whatsappAccountId,
        conversationId: conversationId ?? null,
        eventType,
        error: error instanceof Error ? error.message : "sync failed"
      });
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
