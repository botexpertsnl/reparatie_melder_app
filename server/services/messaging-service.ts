import "server-only";
import { prisma } from "@/lib/prisma";
import { spotlerFetch } from "@/lib/spotler/client";
import { resolveTenantChannel } from "./tenant-channel-service";

export async function sendOutboundText(params: {
  tenantId: string;
  threadId: string;
  phoneNumber: string;
  body: string;
  workItemId?: string;
}) {
  const channel = await resolveTenantChannel(params.tenantId);

  const providerResponse = await spotlerFetch<{ id: string }>(`/v1/channels/${channel.externalChannelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ to: params.phoneNumber, type: "text", text: { body: params.body } })
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
