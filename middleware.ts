import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

const publicPaths = ["/login", "/setup"];
const publicApiPrefixes = ["/api/auth", "/api/setup", "/api/webhooks/zernio", "/api/whatsapp/zernio/callback"];

export default withAuth(function middleware(request) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin") && !request.nextauth.token?.isSystemAdmin) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "System administrator access is required." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}, {
  callbacks: {
    authorized: ({ req, token }) => {
      const { pathname } = req.nextUrl;
      if (publicPaths.includes(pathname) || publicApiPrefixes.some((prefix) => pathname.startsWith(prefix))) return true;
      return Boolean(token);
    }
  },
  pages: { signIn: "/login" }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
