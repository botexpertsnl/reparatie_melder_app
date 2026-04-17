import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext } from "@/lib/multitenancy/tenant-context";
import { prisma } from "@/lib/prisma";
import { ensureTenantZernioChannel } from "@/server/services/zernio-sync-service";
import { createZernioWhatsappTemplate, listZernioWhatsappTemplates } from "@/lib/integrations/zernio/templates";

const schema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  language: z.string().min(1),
  body: z.string().min(1),
  variables: z.array(z.any()).optional(),
  buttons: z.array(z.any()).optional()
});

export async function GET() {
  const ctx = await requireTenantContext();
  if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });

  const channel = await ensureTenantZernioChannel(ctx.tenantId);
  if (!channel.zernioAccountId) return NextResponse.json({ data: [] });
  const templates = await listZernioWhatsappTemplates(channel.zernioAccountId);
  return NextResponse.json({ data: templates.data ?? templates.templates ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await requireTenantContext();
  if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const channel = await ensureTenantZernioChannel(ctx.tenantId);
  if (!channel.zernioAccountId) return NextResponse.json({ error: "No Zernio account" }, { status: 400 });

  const payload = parsed.data;
  const components: Array<Record<string, unknown>> = [
    { type: "BODY", text: payload.body },
    ...(payload.buttons?.length ? [{ type: "BUTTONS", buttons: payload.buttons }] : [])
  ];

  const created = await createZernioWhatsappTemplate({
    accountId: channel.zernioAccountId,
    name: payload.name,
    category: payload.category,
    language: payload.language,
    components
  });
  const template = created.data ?? created.template;

  const saved = await prisma.messageTemplate.create({
    data: {
      tenantId: ctx.tenantId,
      name: payload.name,
      category: payload.category,
      language: payload.language,
      bodyPreview: payload.body,
      externalTemplateId: template?.id ?? created.id,
      variablesSchema: {
        zernioStatus: template?.status ?? "PENDING",
        zernioTemplateName: template?.name ?? payload.name,
        variables: payload.variables ?? [],
        buttons: payload.buttons ?? []
      }
    }
  });

  return NextResponse.json({ data: { template, saved } });
}
