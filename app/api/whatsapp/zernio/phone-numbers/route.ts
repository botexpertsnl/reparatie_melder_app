import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/multitenancy/tenant-context";
import { prisma } from "@/lib/prisma";
import { listZernioPhoneNumbers } from "@/lib/integrations/zernio/phone-numbers";

export async function GET() {
  const ctx = await requireTenantContext();
  if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });

  const channel = await prisma.tenantMessagingChannel.findFirst({ where: { tenantId: ctx.tenantId, provider: "ZERNIO" } });
  if (!channel?.zernioAccountId) return NextResponse.json({ data: [] });

  try {
    const response = await listZernioPhoneNumbers(channel.zernioAccountId);
    return NextResponse.json({ data: response.numbers });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
