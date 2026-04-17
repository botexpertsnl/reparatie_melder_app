import "server-only";
import { prisma } from "@/lib/prisma";
import { sendConversationMessage } from "@/server/services/zernio-sync-service";

export async function sendOutboundText(params: {
  tenantId: string;
  threadId: string;
  phoneNumber: string;
  body: string;
  workItemId?: string;
}) {
  await sendConversationMessage({
    tenantId: params.tenantId,
    threadId: params.threadId,
    text: params.body
  });

  return prisma.message.findFirstOrThrow({
    where: { tenantId: params.tenantId, threadId: params.threadId, direction: "OUTBOUND", body: params.body },
    orderBy: { createdAt: "desc" }
  });
}

export async function sendOutboundTemplate(params: {
  tenantId: string;
  threadId: string;
  phoneNumber: string;
  templateId: string;
  language: string;
  bodyPreview?: string;
  workItemId?: string;
}) {
  await sendConversationMessage({
    tenantId: params.tenantId,
    threadId: params.threadId,
    template: {
      name: params.templateId,
      language: params.language,
      components: []
    }
  });

  return prisma.message.findFirstOrThrow({
    where: { tenantId: params.tenantId, threadId: params.threadId, direction: "OUTBOUND", externalTemplateId: params.templateId },
    orderBy: { createdAt: "desc" }
  });
}
