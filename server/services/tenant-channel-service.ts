import "server-only";
import { prisma } from "@/lib/prisma";

export async function resolveTenantChannel(tenantId: string) {
  const channel = await prisma.tenantMessagingChannel.findFirst({
    where: { tenantId, provider: "ZERNIO", isActive: true }
  });
  if (!channel) throw new Error("No active ZERNIO channel configured for tenant");
  return channel;
}

export async function resolveTenantByWhatsappAccount(whatsappAccountId: string) {
  return prisma.tenantMessagingChannel.findFirst({
    where: { provider: "ZERNIO", whatsappAccountId },
    include: { tenant: true }
  });
}
