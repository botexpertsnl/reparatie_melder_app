import "server-only";
import { prisma } from "@/lib/prisma";

export async function getTenantDashboardStats(tenantId: string) {
  const [active, waitingApproval, completedToday, unreadConversations, messagesSentToday] = await Promise.all([
    prisma.workItem.count({ where: { tenantId, completedAt: null } }),
    prisma.workItem.count({
      where: {
        tenantId,
        currentStage: { requiresApproval: true }
      }
    }),
    prisma.workItem.count({
      where: { tenantId, completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
    }),
    prisma.conversationThread.count({ where: { tenantId, unreadCount: { gt: 0 } } }),
    prisma.message.count({
      where: { tenantId, direction: "OUTBOUND", sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
    })
  ]);

  return { active, waitingApproval, completedToday, unreadConversations, messagesSentToday };
}

export async function getSystemAdminStats() {
  const [totalTenants, activeTenants, tenantsWithActiveChannel, recentWebhookFailures] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.tenantMessagingChannel.groupBy({ by: ["tenantId"], where: { isActive: true } }).then((x) => x.length),
    prisma.webhookEvent.count({ where: { processingStatus: "FAILED", receivedAt: { gte: new Date(Date.now() - 86400000) } } })
  ]);

  return { totalTenants, activeTenants, tenantsWithActiveChannel, recentWebhookFailures };
}
