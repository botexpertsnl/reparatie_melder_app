import { NextRequest, NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const setupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(12, "Use at least 12 characters.").max(128)
});

async function hasSystemAdmin() {
  return (await prisma.user.count({ where: { isSystemAdmin: true } })) > 0;
}

export async function GET() {
  try {
    return NextResponse.json({ data: { setupRequired: !(await hasSystemAdmin()) } });
  } catch {
    return NextResponse.json({ error: "Setup is not available until the database connection is configured." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (await hasSystemAdmin()) return NextResponse.json({ error: "The initial administrator has already been created." }, { status: 409 });
    const parsed = setupSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const passwordHash = hashSync(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        role: UserRole.SYSTEM_ADMIN,
        isSystemAdmin: true
      }
    });
    return NextResponse.json({ data: { id: user.id, email: user.email } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create the initial administrator. The email address may already be in use." }, { status: 500 });
  }
}
