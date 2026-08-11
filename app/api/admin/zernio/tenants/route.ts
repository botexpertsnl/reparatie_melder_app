import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/multitenancy/tenant-context";
import { listZernioProfiles } from "@/lib/integrations/zernio/profiles";
import { listZernioAccounts, listZernioPhoneNumbers } from "@/lib/integrations/zernio/inbox";
import { ensureTenantZernioChannel } from "@/server/services/zernio-sync-service";
import { ensureZernioWebhook } from "@/lib/integrations/zernio/webhook-settings";

function toApiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to manage Zernio connections";
  console.error("[ZERNIO_ADMIN] Connection management failed", message.replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]"));
  if (message === "Unauthorized") return NextResponse.json({ error: "Sign in as a system administrator to manage Zernio connections." }, { status: 401 });
  if (message === "System admin access required") return NextResponse.json({ error: "System administrator access is required." }, { status: 403 });
  return NextResponse.json({ error: "Unable to manage Zernio connections. Check the server logs for details." }, { status: 500 });
}

async function requireSystemAdmin() {
  const ctx = await requireTenantContext();
  if (!ctx.isSystemAdmin) throw new Error("System admin access required");
  return ctx;
}

const updateSchema = z.object({
  tenantId: z.string().min(1),
  profileId: z.string().trim().min(1),
  accountId: z.string().trim().optional()
});

export async function GET() {
  try {
    await requireSystemAdmin();
    const [tenants, profileResponse] = await Promise.all([
      prisma.tenant.findMany({
        orderBy: { name: "asc" },
        include: { channels: { where: { provider: "ZERNIO" }, take: 1 } }
      }),
      listZernioProfiles()
    ]);
    const profiles = profileResponse.profiles ?? profileResponse.data?.profiles ?? [];
    return NextResponse.json({
      data: {
        profiles,
        tenants: tenants.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          isActive: tenant.isActive,
          channel: tenant.channels[0] ?? null
        }))
      }
    });
  } catch (error) {
    return toApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireSystemAdmin();
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { tenantId, profileId, accountId } = parsed.data;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const profileResponse = await listZernioProfiles();
  const profiles = profileResponse.profiles ?? profileResponse.data?.profiles ?? [];
  const profile = profiles.find((item) => item._id === profileId);
  if (!profile) return NextResponse.json({ error: "Zernio profile ID was not found for this API key" }, { status: 400 });

  const accountResponse = await listZernioAccounts(profileId, "whatsapp");
  const accounts = accountResponse.data ?? accountResponse.accounts ?? [];
  const connectedAccounts = accounts.filter((item) => (item.status ?? "connected").toLowerCase() === "connected");
  const selectedAccount = accountId
    ? connectedAccounts.find((item) => item.id === accountId)
    : connectedAccounts.length === 1
      ? connectedAccounts[0]
      : undefined;

  if (!selectedAccount && connectedAccounts.length > 1) {
    return NextResponse.json({
      error: "This profile has multiple connected WhatsApp accounts; select an account ID as well.",
      data: { accounts: connectedAccounts }
    }, { status: 409 });
  }

  const phoneResponse = await listZernioPhoneNumbers();
  const phone = (phoneResponse.data ?? []).find((item) => item.accountId === selectedAccount?.id);
  const pendingAccountId = `pending:${tenantId}`;
  const channel = await prisma.tenantMessagingChannel.upsert({
    where: { tenantId_provider: { tenantId, provider: "ZERNIO" } },
    update: {
      zernioProfileId: profileId,
      zernioAccountId: selectedAccount?.id ?? null,
      whatsappAccountId: selectedAccount?.id ?? pendingAccountId,
      zernioPhoneNumberId: phone?.id ?? null,
      whatsappPhoneNumber: phone?.displayNumber ?? phone?.phoneNumber ?? "",
      displayName: `WhatsApp (ZERNIO) · ${profile.name}`,
      connectionStatus: selectedAccount ? "CONNECTED" : "AWAITING_ACCOUNT",
      isActive: true
    },
    create: {
      tenantId,
      provider: "ZERNIO",
      zernioProfileId: profileId,
      zernioAccountId: selectedAccount?.id,
      whatsappAccountId: selectedAccount?.id ?? pendingAccountId,
      zernioPhoneNumberId: phone?.id,
      whatsappPhoneNumber: phone?.displayNumber ?? phone?.phoneNumber ?? "",
      displayName: `WhatsApp (ZERNIO) · ${profile.name}`,
      connectionStatus: selectedAccount ? "CONNECTED" : "AWAITING_ACCOUNT",
      isActive: true
    }
  });

    return NextResponse.json({ data: { channel, profile, accounts: connectedAccounts } });
  } catch (error) {
    return toApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSystemAdmin();
    const body = await request.json().catch(() => ({})) as { tenantId?: string };
    if (!body.tenantId) return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });
    const channel = await ensureTenantZernioChannel(body.tenantId);
    const webhook = await ensureZernioWebhook();
    return NextResponse.json({ data: { ...channel, webhookConfigured: Boolean(webhook) } });
  } catch (error) {
    return toApiError(error);
  }
}
