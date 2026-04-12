import { SystemAdminShell } from "@/components/layout/system-admin-shell";

export default function SystemAdminLayout({ children }: { children: React.ReactNode }) {
  return <SystemAdminShell>{children}</SystemAdminShell>;
}
