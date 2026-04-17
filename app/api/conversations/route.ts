import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/multitenancy/tenant-context";
import { syncTenantConversations } from "@/server/services/zernio-sync-service";

export async function GET() {
  const ctx = await requireTenantContext();
  if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });

  const threads = await syncTenantConversations(ctx.tenantId);
  return NextResponse.json({ data: threads });
}
