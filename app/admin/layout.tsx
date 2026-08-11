import { SystemAdminShell } from "@/components/layout/system-admin-shell";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";

export default async function SystemAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/diagnostics");
  if (!session.user.isSystemAdmin) redirect("/dashboard");

  return <SystemAdminShell>{children}</SystemAdminShell>;
}
