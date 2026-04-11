"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  ChevronLeft,
  Moon,
  Sun,
  Menu
} from "lucide-react";
import clsx from "clsx";
import { defaultConversations, readStoredConversations } from "@/lib/conversation-store";
import { defaultRepairs, readStoredRepairs } from "@/lib/repair-store";
import { getImpersonatingTenant, isSuperAdmin, stopImpersonation } from "@/lib/impersonation-store";
import { pluralizeLabel, useTenantRepairLabel } from "@/lib/use-tenant-terminology";
import { MobileMenu, type NavSection } from "@/components/layout/mobile-menu";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const repairLabel = useTenantRepairLabel();
  const [collapsed, setCollapsed] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openConversationCount, setOpenConversationCount] = useState(0);
  const [superAdmin, setSuperAdminState] = useState(false);
  const [impersonatingTenant, setImpersonatingTenant] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

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
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const stored = window.localStorage.getItem("statusflow.theme");
    const initial = stored === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("theme-light", initial === "light");
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    const desktopQuery = window.matchMedia("(min-width: 769px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    desktopQuery.addEventListener("change", closeOnDesktop);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      desktopQuery.removeEventListener("change", closeOnDesktop);
    };
  }, []);

  const navSections: NavSection[] = [
    {
      label: "Main",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: LayoutGrid },
        { name: pluralizeLabel(repairLabel), href: "/work-items", icon: Wrench },
        { name: "Conversations", href: "/conversations", icon: MessagesSquare }
      ]
    },
    {
      label: "Settings",
      items: [
        { name: "Workflow", href: "/settings/advanced", icon: Workflow },
        { name: "Templates", href: "/templates", icon: FileText },
        { name: "Quick Replies", href: "/quick-replies", icon: MessageSquareText },
        { name: "Settings", href: "/customers", icon: Settings }
      ]
    },
    {
      label: "System",
      items: [{ name: "System Admin", href: "/admin/diagnostics", icon: Shield }]
    }
  ];

  const visibleSections = navSections.filter((section) => section.label !== "System");

  const handleTenantBadgeClick = () => {
    if (!superAdmin) return;
    if (impersonatingTenant) {
      stopImpersonation();
    }
    window.location.href = "/admin/diagnostics";
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("theme-light", next === "light");
      window.localStorage.setItem("statusflow.theme", next);
      return next;
    });
  };

  const resolveConversationHref = () => {
    const selectedRepairId = window.localStorage.getItem("statusflow.selected-repair-id");
    if (!selectedRepairId) return "/conversations";
    const linkedConversation = readStoredConversations(defaultConversations).find(
      (thread) => thread.linkedRepairId === selectedRepairId
    );
    if (!linkedConversation) return "/conversations";
    return `/conversations?threadId=${linkedConversation.id}`;
  };

  const resolveRepairHref = () => {
    const selectedThreadId = window.localStorage.getItem("statusflow.selected-thread-id");
    if (!selectedThreadId) return "/work-items";
    const selectedConversation = readStoredConversations(defaultConversations).find(
      (thread) => thread.id === selectedThreadId
    );
    if (!selectedConversation?.linkedRepairId) return "/work-items";
    const linkedRepairExists = readStoredRepairs(defaultRepairs).some(
      (repair) => repair.id === selectedConversation.linkedRepairId
    );
    if (!linkedRepairExists) return "/work-items";
    return `/work-items?repairId=${selectedConversation.linkedRepairId}`;
  };

  const handleNavLinkClick = (href: string) => {
    if (href === "/conversations") {
      window.dispatchEvent(new Event("conversations:nav-click"));
      router.push(resolveConversationHref());
      return;
    }

    if (href === "/work-items") {
      router.push(resolveRepairHref());
      return;
    }

    router.push(href);
  };

  return (
    <div
      className={clsx(
        "min-h-screen min-[769px]:grid min-[769px]:transition-[grid-template-columns] min-[769px]:duration-300",
        collapsed ? "min-[769px]:grid-cols-[88px_1fr]" : "min-[769px]:grid-cols-[316px_1fr]"
      )}
      style={{ background: "var(--bg)", color: "var(--text-primary)" }}
    >
      <aside className="sticky top-0 hidden h-screen flex-col overflow-y-auto border-r min-[769px]:flex" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <div className="border-b px-6 py-5" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-[#25d3c4] p-3 text-[#04243a]">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div className={collapsed ? "hidden" : "block"}>
              <div className="text-2xl font-semibold leading-none tracking-tight" style={{ color: "var(--text-primary)" }}>StatusFlow</div>
              <div className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Communication Platform</div>
            </div>
          </div>
        </div>

        <div className={clsx("relative flex-1 py-6", collapsed ? "px-2" : "px-4")}>
          <nav className="space-y-8 pb-16">
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
                          onClick={(event) => {
                            if (item.href === "/conversations") {
                              window.dispatchEvent(new Event("conversations:nav-click"));
                              event.preventDefault();
                              router.push(resolveConversationHref());
                            }

                            if (item.href === "/work-items") {
                              event.preventDefault();
                              router.push(resolveRepairHref());
                            }
                          }}
                          className={clsx(
                            "flex items-center rounded-xl px-3 py-2 text-base font-medium text-slate-300 transition",
                            collapsed ? "justify-center gap-0" : "gap-3",
                            active ? "bg-white/10" : "hover:bg-slate-900/70"
                          )}
                          style={active ? { color: "#25d3c4" } : undefined}
                        >
                          <Icon className={clsx("h-5 w-5", active ? "" : "text-slate-400")} style={active ? { color: "#25d3c4" } : undefined} />
                          {collapsed ? null : item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <button
            type="button"
            onClick={toggleTheme}
            className={clsx(
              "absolute bottom-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border",
              collapsed ? "left-1/2 -translate-x-1/2" : "left-5"
            )}
            style={{ borderColor: "var(--border)", background: "var(--surface-3)", color: "var(--text-secondary)" }}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        <div className="border-t p-4" style={{ borderColor: "var(--border)" }}>
          <button className="flex w-full items-center justify-center rounded-xl p-3 hover:bg-white/5" style={{ color: "var(--text-muted)" }} onClick={() => setCollapsed((prev) => !prev)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <ChevronLeft className={clsx("h-5 w-5 transition-transform", collapsed ? "rotate-180" : "")} />
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col overflow-x-hidden">
        <header
          className="sticky top-0 z-40 flex h-[69px] items-center justify-between gap-3 border-b px-4 min-[769px]:hidden"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
              style={{ borderColor: "var(--border)", background: "var(--surface-3)", color: "var(--text-secondary)" }}
            >
              <Menu className={clsx("h-5 w-5 transition-transform duration-200", isMenuOpen ? "rotate-90 scale-90" : "rotate-0 scale-100")} />
            </button>
            <div className="truncate text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              {impersonatingTenant ?? "AutoGarage De Vries"}
            </div>
          </div>
          {openConversationCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new Event("conversations:nav-click"));
                router.push(resolveConversationHref());
              }}
              className="inline-flex items-center gap-1.5 self-center rounded-full border px-2 py-1 text-[11px] font-semibold"
              style={{ borderColor: "var(--border)", background: "var(--surface-3)", color: "var(--text-secondary)" }}
              aria-label="View open conversations"
            >
              <span>Open</span>
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/20 px-1 text-[10px] font-bold text-amber-300">
                {openConversationCount}
              </span>
            </button>
          ) : null}
        </header>

        <header className="hidden h-[69px] items-center justify-end gap-3 border-b px-6 pr-8 min-[769px]:flex" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <div className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-3)", color: "var(--text-secondary)" }}>
            <span className="text-xs tracking-[0.08em] text-slate-400">Open conversations</span>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new Event("conversations:nav-click"));
                router.push("/conversations");
              }}
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30"
              aria-label="Open conversations page"
            >
              {openConversationCount}
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-3)", color: "var(--text-secondary)" }}>
            {superAdmin ? (
              <button
                type="button"
                className="font-medium text-slate-200 hover:text-white"
                onClick={handleTenantBadgeClick}
              >
                {impersonatingTenant ?? "AutoGarage De Vries"}
              </button>
            ) : (
              "AutoGarage De Vries"
            )}
          </div>
        </header>
        <main className="flex-1 px-5 py-6 min-[769px]:px-10 min-[769px]:py-8">{children}</main>
      </div>

      <MobileMenu
        isOpen={isMenuOpen}
        sections={visibleSections}
        pathname={pathname}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={handleNavLinkClick}
      />
    </div>
  );
}
