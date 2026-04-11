import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/multitenancy/tenant-context";
import { createZernioConnectUrl } from "@/lib/integrations/zernio/connect";

export async function POST() {
  const ctx = await requireTenantContext();
  if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });

  return NextResponse.json({
    data: {
      connectUrl: createZernioConnectUrl(ctx.tenantId)
    }
  });
}
