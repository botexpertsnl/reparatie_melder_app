import { UserRole } from "@prisma/client";

export const canManageSettings = (role: UserRole) =>
  [UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.SYSTEM_ADMIN].includes(role);

export const canManageUsers = (role: UserRole) =>
  [UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.SYSTEM_ADMIN].includes(role);
