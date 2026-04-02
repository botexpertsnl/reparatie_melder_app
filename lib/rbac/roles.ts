import { UserRole } from "@prisma/client";

const managementRoles = new Set<UserRole>([
  UserRole.TENANT_OWNER,
  UserRole.TENANT_ADMIN,
  UserRole.SYSTEM_ADMIN
]);

export const canManageSettings = (role: UserRole) =>
  managementRoles.has(role);

export const canManageUsers = (role: UserRole) =>
  managementRoles.has(role);
