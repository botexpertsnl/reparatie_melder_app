import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/multitenancy/tenant-context";
import { downloadZernioWhatsappMedia } from "@/lib/integrations/zernio/inbox";

export async function GET(request: NextRequest) {
  const ctx = await requireTenantContext();
  if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });
  const mediaId = request.nextUrl.searchParams.get("mediaId");
  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!mediaId || !accountId) return NextResponse.json({ error: "Media and account IDs are required" }, { status: 400 });

  const channel = await prisma.tenantMessagingChannel.findFirst({
    where: { tenantId: ctx.tenantId, provider: "ZERNIO", zernioAccountId: accountId, isActive: true }
  });
  if (!channel) return NextResponse.json({ error: "Media does not belong to this tenant" }, { status: 403 });

  const upstream = await downloadZernioWhatsappMedia(mediaId, accountId);
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=300",
      ...(upstream.headers.get("Content-Disposition") ? { "Content-Disposition": upstream.headers.get("Content-Disposition")! } : {})
    }
  });
}
