import NextAuth, { getServerSession } from "next-auth/next";
import Credentials from "next-auth/providers/credentials";
import { compareSync } from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

type TokenShape = {
  id?: string;
  role?: string;
  tenantId?: string | null;
  isSystemAdmin?: boolean;
};

type SessionShape = {
  user?: {
    id?: string;
    role?: string;
    tenantId?: string | null;
    isSystemAdmin?: boolean;
    name?: string | null;
    email?: string | null;
  };
};

export type AppAuthSession = SessionShape;

export const authOptions = {
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) return null;
        if (!compareSync(password, user.passwordHash)) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          isSystemAdmin: user.isSystemAdmin
        };
      }
    })
  ],
  callbacks: {
    async jwt({
      token,
      user
    }: {
      token: TokenShape;
      user?: TokenShape | null;
    }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.isSystemAdmin = user.isSystemAdmin;
      }
      return token;
    },
    async session({
      session,
      token
    }: {
      session: SessionShape;
      token: TokenShape;
    }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
        session.user.isSystemAdmin = token.isSystemAdmin;
      }
      return session;
    }
  }
};

export function auth() {
  return getServerSession(authOptions as never) as Promise<AppAuthSession | null>;
}

export const nextAuthHandler = NextAuth(
  authOptions as never
);
