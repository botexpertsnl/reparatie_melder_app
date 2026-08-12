import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/multitenancy/tenant-context";
import { listZernioProfiles } from "@/lib/integrations/zernio/profiles";
import { listZernioPhoneNumbers, listZernioWhatsappAccountsForProfile } from "@/lib/integrations/zernio/inbox";
import { ensureTenantZernioChannel } from "@/server/services/zernio-sync-service";
import { ensureZernioWebhook } from "@/lib/integrations/zernio/webhook-settings";

function toApiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to manage Zernio connections";
  console.error("[ZERNIO_ADMIN] Connection management failed", message.replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]"));
  if (message === "Unauthorized") return NextResponse.json({ error: "Sign in as a system administrator to manage Zernio connections." }, { status: 401 });
  if (message === "System admin access required") return NextResponse.json({ error: "System administrator access is required." }, { status: 403 });
  if (message.includes("No connected WhatsApp account was found")) {
    return NextResponse.json({ error: "No active WhatsApp account was found for this Zernio profile. Connect and activate a WhatsApp number in Zernio first, then test the connection again." }, { status: 409 });
  }
  if (message.includes("Multiple WhatsApp accounts")) return NextResponse.json({ error: message }, { status: 409 });
  if (message.includes("ZERNIO_WEBHOOK_SECRET") || message.includes("APP_BASE_URL") || message.includes("NEXTAUTH_URL")) {
    return NextResponse.json({ error: "The Zernio webhook is not configured on the server. Add the required Zernio webhook settings in Vercel, then test again." }, { status: 503 });
  }
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

function isConnectedWhatsappAccount(status?: string) {
  return ["connected", "active", "ready", "verified", "approved"].includes((status ?? "connected").toLowerCase());
}

export async function GET(request: NextRequest) {
  try {
    await requireSystemAdmin();
    const profileId = request.nextUrl.searchParams.get("profileId");
    if (profileId) {
      const accounts = (await listZernioWhatsappAccountsForProfile(profileId))
        .filter((account) => isConnectedWhatsappAccount(account.status))
        .map((account) => ({ id: account.id, displayName: account.displayName, username: account.username, status: account.status }));
      return NextResponse.json({ data: { accounts } });
    }
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
    if (!tenant) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const profileResponse = await listZernioProfiles();
  const profiles = profileResponse.profiles ?? profileResponse.data?.profiles ?? [];
  const profile = profiles.find((item) => item._id === profileId);
  if (!profile) return NextResponse.json({ error: "Zernio profile ID was not found for this API key" }, { status: 400 });

  const accounts = await listZernioWhatsappAccountsForProfile(profileId);
  const connectedAccounts = accounts.filter((item) => isConnectedWhatsappAccount(item.status));
  const selectedAccount = accountId
    ? accounts.find((item) => item.id === accountId)
    : connectedAccounts.length === 1
      ? connectedAccounts[0]
      : undefined;

  if (accountId && !selectedAccount) {
    return NextResponse.json({
      error: "This is not a Zernio WhatsApp account ID for the selected profile. Use the account _id from Zernio, not a Meta WABA ID or phone number ID."
    }, { status: 400 });
  }

  if (selectedAccount && !connectedAccounts.some((item) => item.id === selectedAccount.id)) {
    return NextResponse.json({ error: "The selected Zernio WhatsApp account is not active yet. Finish activating the number in Zernio first." }, { status: 409 });
  }

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
      whatsappPhoneNumber: phone?.displayNumber ?? phone?.phoneNumber ?? selectedAccount?.username ?? "",
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
      whatsappPhoneNumber: phone?.displayNumber ?? phone?.phoneNumber ?? selectedAccount?.username ?? "",
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
    if (!body.tenantId) return NextResponse.json({ error: "Customer ID is required" }, { status: 400 });
    const channel = await ensureTenantZernioChannel(body.tenantId);
    const webhook = await ensureZernioWebhook();
    return NextResponse.json({ data: { ...channel, webhookConfigured: Boolean(webhook) } });
  } catch (error) {
    return toApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireSystemAdmin();
    const body = await request.json().catch(() => ({})) as { tenantId?: string };
    if (!body.tenantId) return NextResponse.json({ error: "Customer ID is required" }, { status: 400 });
    await prisma.tenantMessagingChannel.deleteMany({ where: { tenantId: body.tenantId, provider: "ZERNIO" } });
    return NextResponse.json({ data: { disconnected: true } });
  } catch (error) {
    return toApiError(error);
  }
}
