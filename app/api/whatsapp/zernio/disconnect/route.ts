import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/multitenancy/tenant-context";

export async function POST() {
  const ctx = await requireTenantContext();
  if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });

  await prisma.tenantMessagingChannel.updateMany({
    where: { tenantId: ctx.tenantId, provider: "ZERNIO" },
    data: { isActive: false, connectionStatus: "DISCONNECTED" }
  });

  return NextResponse.json({ ok: true });
}
