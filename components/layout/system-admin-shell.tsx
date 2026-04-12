"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Shield, Building2, ArrowLeftRight } from "lucide-react";
import { canAccessSystemAdminArea } from "@/lib/access/area-access";

const adminNavItems = [
  { href: "/admin/diagnostics", label: "Diagnostics", icon: Building2 }
];

export function SystemAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasAccess = canAccessSystemAdminArea({ pathname });

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--bg)" }}>
        <div className="card max-w-md text-center">
          <h1 className="text-xl font-semibold text-white">System Admin access required</h1>
          <p className="mt-2 text-sm text-slate-400">
            Access checks are wired at area boundaries and can be tightened when RBAC is enabled.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center rounded-xl bg-[#28d9c6] px-4 py-2 text-sm font-semibold text-[#022a36]"
          >
            Return to tenant app
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-[960px]:grid min-[960px]:grid-cols-[270px_1fr]" style={{ background: "var(--bg)", color: "var(--text-primary)" }}>
      <aside className="border-b min-[960px]:border-b-0 min-[960px]:border-r" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <div className="border-b px-6 py-5" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#28d9c6]/15 p-2.5 text-[#69f0df]">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">System Admin</p>
              <p className="text-xs text-slate-400">Platform management</p>
            </div>
          </div>
        </div>

        <nav className="space-y-1 px-4 py-4">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                  active ? "bg-white/10 text-[#69f0df]" : "text-slate-300 hover:bg-slate-900/70"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-5">
          <Link
            href="/dashboard"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm text-slate-300 hover:bg-slate-900/70"
            style={{ borderColor: "var(--border)" }}
          >
            <ArrowLeftRight className="h-4 w-4" />
            Open tenant environment
          </Link>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="border-b px-6 py-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Separated environment</p>
          <h1 className="text-lg font-semibold text-white">System Administration</h1>
        </header>
        <main className="flex-1 px-5 py-6 min-[769px]:px-10 min-[769px]:py-8">{children}</main>
      </div>
    </div>
  );
}
