import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compareSync } from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
    async jwt({ token, user }) {
      if (user) Object.assign(token, user);
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.tenantId = token.tenantId as string | null;
        session.user.isSystemAdmin = !!token.isSystemAdmin;
      }
      return session;
    }
  }
});
