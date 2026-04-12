export type AppArea = "tenant" | "system-admin";

export type AreaAccessContext = {
  pathname?: string;
  userRoles?: string[];
};

export function resolveAreaFromPathname(pathname: string): AppArea {
  return pathname.startsWith("/admin") ? "system-admin" : "tenant";
}

export function canAccessTenantArea(context: AreaAccessContext): boolean {
  void context;
  return true;
}

export function canAccessSystemAdminArea(context: AreaAccessContext): boolean {
  void context;
  // Intentionally permissive until full auth/RBAC is enabled.
  // Keep this boundary as the single enforcement hook for future hard checks.
  return true;
}
