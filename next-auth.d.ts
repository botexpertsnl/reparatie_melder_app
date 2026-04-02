import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      tenantId: string | null;
      isSystemAdmin: boolean;
      name?: string | null;
      email?: string | null;
    };
  }
}
