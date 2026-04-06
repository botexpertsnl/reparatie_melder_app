"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquareText,
  Building2,
  ChevronDown,
  LayoutGrid,
  Wrench,
  MessagesSquare,
  FileText,
  Workflow,
  Settings,
  Shield,
  ChevronLeft
} from "lucide-react";
import clsx from "clsx";

const navSections = [
  {
    label: "Main",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutGrid },
      { name: "Repairs", href: "/work-items", icon: Wrench },
      { name: "Conversations", href: "/conversations", icon: MessagesSquare }
    ]
  },
  {
    label: "Settings",
    items: [
      { name: "Workflow", href: "/settings/advanced", icon: Workflow },
      { name: "Templates", href: "/templates", icon: FileText },
      { name: "Tenant Settings", href: "/customers", icon: Settings }
    ]
  },
  {
    label: "System",
    items: [{ name: "System Admin", href: "/admin/diagnostics", icon: Shield }]
  }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#040914] text-slate-100 md:grid md:grid-cols-[316px_1fr]">
      <aside className="flex min-h-screen flex-col border-r border-[#1a2436] bg-[#060d19]">
        <div className="border-b border-[#1a2436] px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-[#25d3c4] p-3 text-[#04243a]">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-semibold leading-none tracking-tight text-white">StatusFlow</div>
              <div className="mt-1 text-sm text-slate-400">Communication Platform</div>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-6">
          <button className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-slate-200 hover:bg-slate-900/70">
            <span className="flex items-center gap-3 text-base font-medium">
              <Building2 className="h-5 w-5 text-slate-400" />
              AutoGarage De Vries
            </span>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </button>

          <nav className="mt-8 space-y-8">
            {navSections.map((section) => (
              <div key={section.label}>
                <h2 className="px-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{section.label}</h2>
                <ul className="mt-3 space-y-1">
                  {section.items.map((item) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={clsx(
                            "flex items-center gap-3 rounded-xl px-3 py-2 text-base font-medium text-slate-300 transition",
                            active ? "bg-white/10 text-[#25d3c4]" : "hover:bg-slate-900/70"
                          )}
                        >
                          <Icon className={clsx("h-5 w-5", active ? "text-[#25d3c4]" : "text-slate-400")} />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="border-t border-[#1a2436] p-4">
          <button className="flex w-full items-center justify-center rounded-md p-3 text-slate-500 hover:bg-slate-900/70">
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex h-[69px] items-center justify-end border-b border-[#1a2436] bg-[#101722] px-8">
          <div className="rounded-lg bg-[#182334] px-4 py-2 text-sm text-slate-400">AutoGarage De Vries</div>
        </header>
        <main className="flex-1 px-10 py-8">{children}</main>
      </div>
    </div>
  );
}
