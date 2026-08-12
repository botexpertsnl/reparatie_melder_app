import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "statusflow_impersonated_tenant";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.isSystemAdmin) return NextResponse.json({ error: "System administrator access is required." }, { status: 403 });
  const parsed = z.object({ tenantId: z.string().min(1) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Customer ID is required." }, { status: 400 });
  const tenant = await prisma.tenant.findUnique({ where: { id: parsed.data.tenantId }, select: { id: true, name: true, isActive: true } });
  if (!tenant?.isActive) return NextResponse.json({ error: "Customer not found or inactive." }, { status: 404 });
  const response = NextResponse.json({ data: { tenant } });
  response.cookies.set(COOKIE_NAME, tenant.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  return response;
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.isSystemAdmin) return NextResponse.json({ error: "System administrator access is required." }, { status: 403 });
  const response = NextResponse.json({ data: { stopped: true } });
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
