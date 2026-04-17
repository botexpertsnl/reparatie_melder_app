import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext } from "@/lib/multitenancy/tenant-context";
import { prisma } from "@/lib/prisma";
import { sendConversationMessage, syncConversationFromZernio } from "@/server/services/zernio-sync-service";

const postSchema = z.object({
  text: z.string().trim().min(1).optional(),
  attachments: z.array(z.object({ url: z.string().url(), mimeType: z.string().optional(), filename: z.string().optional() })).optional(),
  template: z
    .object({
      name: z.string().min(1),
      language: z.string().min(1),
      components: z.array(z.record(z.string(), z.unknown())).optional()
    })
    .optional()
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireTenantContext();
  if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });
  const { id } = await params;

  const thread = await prisma.conversationThread.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  if (thread.externalConversationId) {
    await syncConversationFromZernio(ctx.tenantId, thread.externalConversationId);
  }

  const messages = await prisma.message.findMany({ where: { tenantId: ctx.tenantId, threadId: id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ data: messages });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireTenantContext();
  if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });
  const { id } = await params;
  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await sendConversationMessage({ tenantId: ctx.tenantId, threadId: id, ...parsed.data });
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "WHATSAPP_TEMPLATE_REQUIRED") {
      return NextResponse.json({ error: "Template required outside 24-hour WhatsApp window" }, { status: 409 });
    }
    throw error;
  }
}
