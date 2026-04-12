import { AppShell } from "@/components/layout/app-shell";
import { AuthSessionProvider } from "@/components/providers/session-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <AppShell>{children}</AppShell>
    </AuthSessionProvider>
  );
}
