import { auth } from "@/lib/auth/auth";
import { cookies } from "next/headers";

export async function requireTenantContext() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!session.user.tenantId && !session.user.isSystemAdmin) throw new Error("Tenant context required");
  const impersonatedTenantId = session.user.isSystemAdmin
    ? (await cookies()).get("statusflow_impersonated_tenant")?.value ?? null
    : null;
  return {
    tenantId: session.user.tenantId ?? impersonatedTenantId,
    userId: session.user.id,
    isSystemAdmin: session.user.isSystemAdmin,
    role: session.user.role
  };
}
