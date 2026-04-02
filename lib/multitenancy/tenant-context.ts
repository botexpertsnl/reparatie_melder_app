import { auth } from "@/lib/auth/auth";

export async function requireTenantContext() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!session.user.tenantId && !session.user.isSystemAdmin) throw new Error("Tenant context required");
  return {
    tenantId: session.user.tenantId,
    userId: session.user.id,
    isSystemAdmin: session.user.isSystemAdmin,
    role: session.user.role
  };
}
