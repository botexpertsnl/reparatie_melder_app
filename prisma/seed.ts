import { PrismaClient, UserRole, Direction, MessageStatus } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationThread.deleteMany();
  await prisma.workItem.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenantMessagingChannel.deleteMany();
  await prisma.workflowStage.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.tenantSettings.deleteMany();
  await prisma.tenant.deleteMany();

  const admin = await prisma.user.create({
    data: {
      name: "Platform Admin",
      email: "admin@statusflow.app",
      passwordHash: hashSync("Admin!234", 10),
      role: UserRole.SYSTEM_ADMIN,
      isSystemAdmin: true
    }
  });

  const tenants = await Promise.all([
    prisma.tenant.create({ data: { name: "Velocity Garage", slug: "velocity-garage", industryType: "GARAGE" } }),
    prisma.tenant.create({ data: { name: "FixFast Mobile", slug: "fixfast-mobile", industryType: "DEVICE_REPAIR" } }),
    prisma.tenant.create({ data: { name: "BrightInstall", slug: "brightinstall", industryType: "INSTALLER" } })
  ]);

  for (const [index, tenant] of tenants.entries()) {
    await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        assetLabel: ["Car", "Device", "Installation"][index],
        workItemLabel: ["Repair", "Repair", "Job"][index],
        customerLabel: "Customer",
        businessLabel: tenant.name
      }
    });

    const stages = await prisma.workflowStage.createManyAndReturn({
      data: [
        { tenantId: tenant.id, key: "new", displayName: "New", sortOrder: 1, isDefaultStartStage: true },
        { tenantId: tenant.id, key: "in_progress", displayName: "In Progress", sortOrder: 2 },
        { tenantId: tenant.id, key: "approval", displayName: "Waiting for customer approval", sortOrder: 3, requiresApproval: index === 0, isActive: index === 0 },
        { tenantId: tenant.id, key: "completed", displayName: "Completed", sortOrder: 4, isTerminal: true }
      ]
    });

    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        firstName: "Alex",
        lastName: "Jansen",
        fullName: "Alex Jansen",
        phoneNumber: "+31612345678",
        email: `alex+${tenant.slug}@mail.test`
      }
    });

    const asset = await prisma.asset.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        assetType: ["Car", "Phone", "Site"][index],
        displayName: ["Volkswagen Golf", "iPhone 14", "Solar install unit"][index]
      }
    });

    const workItem = await prisma.workItem.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        assetId: asset.id,
        title: `Main ${["repair", "device fix", "installation"] [index]}`,
        currentStageId: stages[0].id,
        internalStatus: "OPEN"
      }
    });

    const channel = await prisma.tenantMessagingChannel.create({
      data: {
        tenantId: tenant.id,
        provider: "ZERNIO",
        zernioProfileId: `zernio-profile-${index + 1}`,
        zernioAccountId: `zernio-account-${index + 1}`,
        whatsappAccountId: `zernio-wa-account-${index + 1}`,
        zernioPhoneNumberId: `zernio-phone-${index + 1}`,
        whatsappPhoneNumber: `+319700000000${index + 1}`,
        displayName: `WhatsApp (ZERNIO) - ${tenant.name}`,
        connectionStatus: "CONNECTED"
      }
    });

    const thread = await prisma.conversationThread.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        assetId: asset.id,
        workItemId: workItem.id,
        whatsappAccountId: channel.whatsappAccountId,
        phoneNumber: customer.phoneNumber,
        lastMessageAt: new Date()
      }
    });

    await prisma.message.create({
      data: {
        tenantId: tenant.id,
        threadId: thread.id,
        customerId: customer.id,
        workItemId: workItem.id,
        direction: Direction.OUTBOUND,
        type: "TEXT",
        body: "Your work item was created and is now in progress.",
        status: MessageStatus.SENT,
        sentAt: new Date()
      }
    });

    await prisma.messageTemplate.create({
      data: {
        tenantId: tenant.id,
        name: "Stage Update",
        category: "update",
        language: "en",
        bodyPreview: "Hi {{name}}, your {{workItemLabel}} is now {{stageName}}."
      }
    });

    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: `${tenant.name} Owner`,
        email: `owner@${tenant.slug}.app`,
        passwordHash: hashSync("Owner!234", 10),
        role: UserRole.TENANT_OWNER
      }
    });
  }

  console.log(`Seed complete. System admin: ${admin.email}`);
}

main().finally(() => prisma.$disconnect());
