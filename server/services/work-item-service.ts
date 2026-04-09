import "server-only";
import { prisma } from "@/lib/prisma";
import { sendOutboundText } from "./messaging-service";

export async function transitionWorkItemStage(params: {
  tenantId: string;
  workItemId: string;
  toStageId: string;
  actorUserId: string;
}) {
  const workItem = await prisma.workItem.findFirst({ where: { id: params.workItemId, tenantId: params.tenantId } });
  if (!workItem) throw new Error("Work item not found");

  const rule = await prisma.stageTransitionRule.findFirst({
    where: {
      tenantId: params.tenantId,
      fromStageId: workItem.currentStageId,
      toStageId: params.toStageId,
      isAllowed: true
    }
  });
  if (!rule) throw new Error("Stage transition is not allowed");

  const stage = await prisma.workflowStage.findFirst({ where: { id: params.toStageId, tenantId: params.tenantId } });
  if (!stage) throw new Error("Target stage not found");

  const updated = await prisma.workItem.update({
    where: { id: workItem.id },
    data: {
      currentStageId: stage.id,
      internalStatus: stage.isTerminal ? "COMPLETED" : "OPEN",
      completedAt: stage.isTerminal ? new Date() : null
    }
  });

  await prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      userId: params.actorUserId,
      action: "WORK_ITEM_STAGE_CHANGED",
      entityType: "WorkItem",
      entityId: workItem.id,
      metadata: { from: workItem.currentStageId, to: stage.id }
    }
  });

  if (stage.requiresApproval) {
    await prisma.approvalRequest.create({
      data: { tenantId: params.tenantId, workItemId: workItem.id, stageId: stage.id, status: "PENDING" }
    });
  }

  if (stage.defaultTemplateId) {
    const template = await prisma.messageTemplate.findFirst({
      where: { id: stage.defaultTemplateId, tenantId: params.tenantId, isActive: true }
    });

    if (template) {
      const linkedThread = await prisma.conversationThread.findFirst({
        where: { tenantId: params.tenantId, workItemId: workItem.id },
        orderBy: { updatedAt: "desc" }
      });

      if (linkedThread) {
        await sendOutboundText({
          tenantId: params.tenantId,
          threadId: linkedThread.id,
          phoneNumber: linkedThread.phoneNumber,
          body: template.bodyPreview,
          workItemId: workItem.id
        });

        await prisma.auditLog.create({
          data: {
            tenantId: params.tenantId,
            userId: params.actorUserId,
            action: "WORK_ITEM_STAGE_TEMPLATE_SENT",
            entityType: "WorkItem",
            entityId: workItem.id,
            metadata: { stageId: stage.id, templateId: template.id, threadId: linkedThread.id }
          }
        });
      }
    }
  }

  return updated;
}
