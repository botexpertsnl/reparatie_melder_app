import "server-only";
import { prisma } from "@/lib/prisma";
import { sendZernioText } from "@/lib/integrations/zernio/whatsapp";
import { sendZernioTemplate } from "@/lib/integrations/zernio/templates";
import { resolveTenantChannel } from "./tenant-channel-service";

export async function sendOutboundText(params: {
  tenantId: string;
  threadId: string;
  phoneNumber: string;
  body: string;
  workItemId?: string;
}) {
  const channel = await resolveTenantChannel(params.tenantId);

  const providerResponse = await sendZernioText({
    whatsappAccountId: channel.whatsappAccountId,
    to: params.phoneNumber,
    body: params.body
  });

  return prisma.message.create({
    data: {
      tenantId: params.tenantId,
      threadId: params.threadId,
      workItemId: params.workItemId,
      direction: "OUTBOUND",
      type: "TEXT",
      body: params.body,
      status: "SENT",
      externalMessageId: providerResponse.id,
      sentAt: new Date(),
      rawPayload: providerResponse
    }
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
  const channel = await resolveTenantChannel(params.tenantId);
  const providerResponse = await sendZernioTemplate({
    whatsappAccountId: channel.whatsappAccountId,
    to: params.phoneNumber,
    templateId: params.templateId,
    language: params.language
  });

  return prisma.message.create({
    data: {
      tenantId: params.tenantId,
      threadId: params.threadId,
      workItemId: params.workItemId,
      direction: "OUTBOUND",
      type: "TEMPLATE",
      body: params.bodyPreview ?? "Template sent",
      status: "SENT",
      externalTemplateId: params.templateId,
      externalMessageId: providerResponse.id,
      sentAt: new Date(),
      rawPayload: providerResponse
    }
  });
}
