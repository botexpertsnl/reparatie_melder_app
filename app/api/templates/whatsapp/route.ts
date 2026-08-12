import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext } from "@/lib/multitenancy/tenant-context";
import { prisma } from "@/lib/prisma";
import { ensureTenantZernioChannel } from "@/server/services/zernio-sync-service";
import { createZernioWhatsappTemplate, listZernioWhatsappTemplates } from "@/lib/integrations/zernio/templates";
import { ZernioError } from "@/lib/integrations/zernio/client";

const schema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  language: z.string().min(1),
  body: z.string().min(1),
  variables: z.array(z.any()).optional(),
  buttons: z.array(z.any()).optional()
});

const updateSchema = z.object({
  externalTemplateId: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  language: z.string().min(1),
  body: z.string(),
  variables: z.array(z.any()).optional(),
  buttons: z.array(z.any()),
  active: z.boolean()
});

function getRemoteComponents(template: { components?: Array<Record<string, unknown>> }) {
  const components = template.components ?? [];
  const bodyComponent = components.find((component) => String(component.type ?? "").toLowerCase() === "body");
  const buttonsComponent = components.find((component) => String(component.type ?? "").toLowerCase() === "buttons");
  return {
    body: typeof bodyComponent?.text === "string" ? bodyComponent.text : "",
    buttons: Array.isArray(buttonsComponent?.buttons) ? buttonsComponent.buttons : []
  };
}

function normalizeRemoteButtons(buttons: unknown[], templateId: string) {
  return buttons.map((button, index) => {
    const value = button && typeof button === "object" ? button as Record<string, unknown> : {};
    const type = String(value.type ?? "quick_reply").toUpperCase();
    const id = typeof value.id === "string" ? value.id : `zernio_${templateId}_btn_${index + 1}`;
    const text = typeof value.text === "string" ? value.text : "";
    if (type === "URL") return { id, type: "URL", text, url: typeof value.url === "string" ? value.url : "" };
    if (type === "PHONE_NUMBER" || type === "PHONE") {
      const phoneNumber = typeof value.phone_number === "string" ? value.phone_number : typeof value.phoneNumber === "string" ? value.phoneNumber : "";
      return { id, type: "PHONE_NUMBER", text, phoneNumber };
    }
    return { id, type: "QUICK_REPLY", text };
  });
}

function inferBodyVariables(body: string) {
  const indexes = [...body.matchAll(/{{(\d+)}}/g)].map((match) => Number(match[1]));
  return [...new Set(indexes)].sort((left, right) => left - right).map((index) => ({
    id: `var_${index}`,
    key: `{{${index}}}`,
    label: `Variable ${index}`,
    index,
    mode: "manual",
    manualValue: "",
    repairField: "customerName"
  }));
}

export async function GET() {
  const ctx = await requireTenantContext();
  if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });

  const channel = await ensureTenantZernioChannel(ctx.tenantId);
  if (!channel.zernioAccountId) return NextResponse.json({ data: [] });
  const templates = await listZernioWhatsappTemplates(channel.zernioAccountId);
  const remoteTemplates = Array.isArray(templates.data)
    ? templates.data
    : templates.data?.templates ?? templates.templates ?? [];
  const storedTemplates = await prisma.messageTemplate.findMany({ where: { tenantId: ctx.tenantId, isActive: true } });
  const data = remoteTemplates.map((template) => {
    const remote = template as { id?: string; name?: string; category?: string; language?: string; status?: string; components?: Array<Record<string, unknown>> };
    const stored = storedTemplates.find((item) => item.externalTemplateId === remote.id || item.name === remote.name);
    const schema = stored?.variablesSchema && typeof stored.variablesSchema === "object"
      ? stored.variablesSchema as { variables?: unknown[]; buttons?: unknown[] }
      : {};
    const remoteContent = getRemoteComponents(remote);
    return {
      ...remote,
      id: remote.id ?? stored?.id,
      body: stored?.bodyPreview || remoteContent.body,
      variables: schema.variables ?? inferBodyVariables(remoteContent.body),
      buttons: schema.buttons ?? normalizeRemoteButtons(remoteContent.buttons, remote.id ?? stored?.id ?? remote.name ?? "template"),
      active: stored?.isActive ?? true
    };
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantContext();
    if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const channel = await ensureTenantZernioChannel(ctx.tenantId);
    if (!channel.zernioAccountId) return NextResponse.json({ error: "No Zernio account is connected for this customer." }, { status: 400 });

    const payload = parsed.data;
    const buttons = payload.buttons?.map((button) => {
      if (!button || typeof button !== "object") return button;
      const value = button as { type?: string; text?: string; url?: string; phoneNumber?: string };
      if (value.type === "URL") return { type: "url", text: value.text, url: value.url };
      if (value.type === "PHONE_NUMBER") return { type: "phone_number", text: value.text, phone_number: value.phoneNumber };
      return { type: "quick_reply", text: value.text };
    });
    const components: Array<Record<string, unknown>> = [
      { type: "body", text: payload.body },
      ...(buttons?.length ? [{ type: "buttons", buttons }] : [])
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
  } catch (error) {
    if (error instanceof ZernioError) {
      return NextResponse.json(
        { error: error.message.replace(/^ZERNIO API request failed:\s*/i, "") },
        { status: error.status >= 400 && error.status < 500 ? error.status : 502 }
      );
    }
    throw error;
  }
}

export async function PATCH(request: NextRequest) {
  const ctx = await requireTenantContext();
  if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const payload = parsed.data;
  const existing = await prisma.messageTemplate.findFirst({
    where: { tenantId: ctx.tenantId, externalTemplateId: payload.externalTemplateId }
  });
  const data = {
    name: payload.name,
    category: payload.category,
    language: payload.language,
    bodyPreview: payload.body,
    externalTemplateId: payload.externalTemplateId,
    isActive: payload.active,
    variablesSchema: { variables: payload.variables ?? [], buttons: payload.buttons }
  };
  const saved = existing
    ? await prisma.messageTemplate.update({ where: { id: existing.id }, data })
    : await prisma.messageTemplate.create({ data: { tenantId: ctx.tenantId, ...data } });
  return NextResponse.json({ data: saved });
}
