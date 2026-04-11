import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext } from "@/lib/multitenancy/tenant-context";
import { prisma } from "@/lib/prisma";
import { verifyZernioPhoneNumber } from "@/lib/integrations/zernio/phone-numbers";

const schema = z.object({ phoneNumberId: z.string().min(1) });

export async function POST(request: NextRequest) {
  const ctx = await requireTenantContext();
  if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const channel = await prisma.tenantMessagingChannel.findFirst({ where: { tenantId: ctx.tenantId, provider: "ZERNIO" } });
  if (!channel?.zernioAccountId) return NextResponse.json({ error: "No connected account" }, { status: 400 });

  await verifyZernioPhoneNumber(channel.zernioAccountId, parsed.data.phoneNumberId);
  await prisma.tenantMessagingChannel.update({
    where: { id: channel.id },
    data: { zernioPhoneNumberId: parsed.data.phoneNumberId }
  });

  return NextResponse.json({ ok: true });
}
