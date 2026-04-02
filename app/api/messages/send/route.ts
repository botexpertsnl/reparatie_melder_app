import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendOutboundText } from "@/server/services/messaging-service";
import { requireTenantContext } from "@/lib/multitenancy/tenant-context";

const schema = z.object({
  threadId: z.string().min(1),
  phoneNumber: z.string().min(7),
  body: z.string().min(1),
  workItemId: z.string().optional()
});

export async function POST(request: NextRequest) {
  const ctx = await requireTenantContext();
  if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const message = await sendOutboundText({ tenantId: ctx.tenantId, ...parsed.data });
  return NextResponse.json({ data: message });
}
