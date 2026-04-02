import "server-only";
import { prisma } from "@/lib/db/prisma";

export async function resolveTenantChannel(tenantId: string) {
  const channel = await prisma.tenantMessagingChannel.findFirst({
    where: { tenantId, provider: "SPOTLER", isActive: true }
  });
  if (!channel) throw new Error("No active Spotler channel configured for tenant");
  return channel;
}

export async function resolveTenantByExternalChannel(externalChannelId: string) {
  return prisma.tenantMessagingChannel.findFirst({
    where: { provider: "SPOTLER", externalChannelId },
    include: { tenant: true }
  });
}
