import { NextRequest, NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/multitenancy/tenant-context";
import { prisma } from "@/lib/prisma";
import { ensureTenantZernioChannel, syncConversationFromZernio } from "@/server/services/zernio-sync-service";
import { deleteZernioConversationMessage } from "@/lib/integrations/zernio/inbox";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  const ctx = await requireTenantContext();
  if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });
  const { id, messageId } = await params;

  const thread = await prisma.conversationThread.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!thread?.externalConversationId) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  const channel = await ensureTenantZernioChannel(ctx.tenantId);
  if (!channel.zernioAccountId) return NextResponse.json({ error: "No Zernio account" }, { status: 400 });

  await deleteZernioConversationMessage(thread.externalConversationId, messageId, channel.zernioAccountId);
  await syncConversationFromZernio(ctx.tenantId, thread.externalConversationId);
  return NextResponse.json({ ok: true });
}
