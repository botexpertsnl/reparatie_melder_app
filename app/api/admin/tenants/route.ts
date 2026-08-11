import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/multitenancy/tenant-context";

async function requireSystemAdmin() {
  const context = await requireTenantContext();
  if (!context.isSystemAdmin) throw new Error("Forbidden");
}

const roleSchema = z.enum(["TENANT_OWNER", "TENANT_ADMIN", "EMPLOYEE"]);
const commandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("createTenant"), name: z.string().trim().min(2).max(120), industryType: z.string().trim().min(2).max(80).default("REPAIR") }),
  z.object({ action: z.literal("saveSettings"), tenantId: z.string(), businessLabel: z.string().trim().min(2).max(120), workItemLabel: z.string().trim().min(2).max(50), assetLabel: z.string().trim().min(2).max(50), customerLabel: z.string().trim().min(2).max(50) }),
  z.object({ action: z.literal("createUser"), tenantId: z.string(), name: z.string().trim().min(2).max(120), email: z.string().trim().email(), password: z.string().min(12).max(128), role: roleSchema }),
  z.object({ action: z.literal("updateUser"), tenantId: z.string(), userId: z.string(), name: z.string().trim().min(2).max(120), role: roleSchema, isActive: z.boolean() }),
  z.object({ action: z.literal("resetPassword"), tenantId: z.string(), userId: z.string(), password: z.string().min(12).max(128) })
]);

function slugify(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "tenant";
}

export async function GET() {
  try {
    await requireSystemAdmin();
    const tenants = await prisma.tenant.findMany({
      orderBy: { name: "asc" },
      include: { settings: true, users: { orderBy: { name: "asc" }, select: { id: true, name: true, email: true, role: true, isActive: true } }, channels: { where: { provider: "ZERNIO" }, take: 1 } }
    });
    return NextResponse.json({ data: { tenants } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "Forbidden" ? "System administrator access is required." : "Unable to load customers." }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSystemAdmin();
    const input = commandSchema.safeParse(await request.json());
    if (!input.success) return NextResponse.json({ error: input.error.flatten() }, { status: 400 });
    const data = input.data;
    if (data.action === "createTenant") {
      const base = slugify(data.name); let slug = base; let suffix = 2;
      while (await prisma.tenant.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${suffix++}`;
      const tenant = await prisma.tenant.create({ data: { name: data.name, slug, industryType: data.industryType, settings: { create: { businessLabel: data.name, workItemLabel: "Repair", assetLabel: "Asset", customerLabel: "Customer" } } } });
      return NextResponse.json({ data: { tenant } }, { status: 201 });
    }
    if (data.action === "saveSettings") {
      await prisma.tenantSettings.upsert({ where: { tenantId: data.tenantId }, create: { tenantId: data.tenantId, businessLabel: data.businessLabel, workItemLabel: data.workItemLabel, assetLabel: data.assetLabel, customerLabel: data.customerLabel }, update: { businessLabel: data.businessLabel, workItemLabel: data.workItemLabel, assetLabel: data.assetLabel, customerLabel: data.customerLabel } });
      return NextResponse.json({ data: { ok: true } });
    }
    if (data.action === "createUser") {
      const user = await prisma.user.create({ data: { tenantId: data.tenantId, name: data.name, email: data.email.toLowerCase(), passwordHash: hashSync(data.password, 12), role: data.role } });
      return NextResponse.json({ data: { id: user.id } }, { status: 201 });
    }
    const user = await prisma.user.findFirst({ where: { id: data.userId, tenantId: data.tenantId } });
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (data.action === "updateUser") await prisma.user.update({ where: { id: user.id }, data: { name: data.name, role: data.role as UserRole, isActive: data.isActive } });
    if (data.action === "resetPassword") await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashSync(data.password, 12) } });
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save changes.";
    return NextResponse.json({ error: message.includes("Unique constraint") ? "That email address is already in use." : "Unable to save changes." }, { status: 500 });
  }
}
