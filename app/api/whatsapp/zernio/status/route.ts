import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/multitenancy/tenant-context";

export async function GET() {
  const ctx = await requireTenantContext();
  if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });

  const channel = await prisma.tenantMessagingChannel.findFirst({
    where: { tenantId: ctx.tenantId, provider: "ZERNIO" },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json({ data: channel });
}
