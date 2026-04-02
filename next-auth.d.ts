declare module "next-auth" {
  interface Session {
    expires: string;
    user: {
      id: string;
      role: string;
      tenantId: string | null;
      isSystemAdmin: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    role: string;
    tenantId: string | null;
    isSystemAdmin: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    tenantId: string | null;
    isSystemAdmin: boolean;
  }
}
