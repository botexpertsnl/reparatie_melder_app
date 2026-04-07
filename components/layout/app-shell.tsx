"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MessageSquareText,
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
import { defaultConversations, readStoredConversations } from "@/lib/conversation-store";
import { getImpersonatingTenant, isSuperAdmin, stopImpersonation } from "@/lib/impersonation-store";

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
  const [collapsed, setCollapsed] = useState(false);
  const [openConversationCount, setOpenConversationCount] = useState(0);
  const [superAdmin, setSuperAdminState] = useState(false);
  const [impersonatingTenant, setImpersonatingTenant] = useState<string | null>(null);

  useEffect(() => {
    const refreshOpenCount = () => {
      const count = readStoredConversations(defaultConversations).filter((thread) => thread.open).length;
      setOpenConversationCount(count);
    };

    refreshOpenCount();
    window.addEventListener("conversations:changed", refreshOpenCount);
    window.addEventListener("storage", refreshOpenCount);

    return () => {
      window.removeEventListener("conversations:changed", refreshOpenCount);
      window.removeEventListener("storage", refreshOpenCount);
    };
  }, []);

  useEffect(() => {
    setSuperAdminState(isSuperAdmin());
    setImpersonatingTenant(getImpersonatingTenant());
  }, [pathname]);

  const visibleSections = navSections.filter((section) => (section.label === "System" ? superAdmin && !impersonatingTenant : true));

  return (
    <div className={clsx("min-h-screen bg-[#040914] text-slate-100 md:grid", collapsed ? "md:grid-cols-[88px_1fr]" : "md:grid-cols-[316px_1fr]")}>
      <aside className="flex min-h-screen flex-col border-r border-[#1a2436] bg-[#060d19]">
        <div className={clsx("border-b border-[#1a2436] py-5", collapsed ? "px-4" : "px-6")}>
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-[#25d3c4] p-3 text-[#04243a]">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div className={collapsed ? "hidden" : "block"}>
              <div className="text-2xl font-semibold leading-none tracking-tight text-white">StatusFlow</div>
              <div className="mt-1 text-sm text-slate-400">Communication Platform</div>
            </div>
          </div>
        </div>

        <div className={clsx("flex-1 py-6", collapsed ? "px-2" : "px-4")}>
          <nav className="space-y-8">
            {visibleSections.map((section) => (
              <div key={section.label}>
                <h2 className={clsx("px-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500", collapsed ? "hidden" : "block")}>{section.label}</h2>
                <ul className="mt-3 space-y-1">
                  {section.items.map((item) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={clsx(
                            "flex items-center rounded-xl px-3 py-2 text-base font-medium text-slate-300 transition",
                            collapsed ? "justify-center gap-0" : "gap-3",
                            active ? "bg-white/10 text-[#25d3c4]" : "hover:bg-slate-900/70"
                          )}
                        >
                          <Icon className={clsx("h-5 w-5", active ? "text-[#25d3c4]" : "text-slate-400")} />
                          {collapsed ? null : item.name}
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
          <button className="flex w-full items-center justify-center rounded-md p-3 text-slate-500 hover:bg-slate-900/70" onClick={() => setCollapsed((prev) => !prev)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <ChevronLeft className={clsx("h-5 w-5 transition-transform", collapsed ? "rotate-180" : "")} />
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex h-[69px] items-center justify-end border-b border-[#1a2436] bg-[#101722] px-8">
          <div className="flex items-center gap-2 rounded-lg bg-[#182334] px-4 py-2 text-sm text-slate-400">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-xs font-semibold text-amber-300">{openConversationCount}</span>
            {superAdmin && impersonatingTenant ? (
              <button
                type="button"
                className="font-medium text-slate-200 hover:text-white"
                onClick={() => {
                  stopImpersonation();
                  window.location.href = "/admin/diagnostics";
                }}
              >
                {impersonatingTenant}
              </button>
            ) : (
              "AutoGarage De Vries"
            )}
          </div>
        </header>
        <main className="flex-1 px-10 py-8">{children}</main>
      </div>
    </div>
  );
}
