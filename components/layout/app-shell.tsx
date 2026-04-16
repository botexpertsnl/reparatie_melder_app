"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type TouchEvent } from "react";
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
  const [approvedConversationCount, setApprovedConversationCount] = useState(0);
  const [notApprovedConversationCount, setNotApprovedConversationCount] = useState(0);
  const [superAdmin, setSuperAdminState] = useState(false);
  const [impersonatingTenant, setImpersonatingTenant] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [allowContextualSwipeOpen, setAllowContextualSwipeOpen] = useState(false);
  const [menuOpeningProgress, setMenuOpeningProgress] = useState(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeGestureIntentRef = useRef<"pending" | "horizontal" | "vertical">("pending");

  useEffect(() => {
    const refreshOpenCount = () => {
      const conversations = readStoredConversations(defaultConversations);
      const repairs = readStoredRepairs(defaultRepairs);
      const repairStageById = new Map(
        repairs.map((repair) => [repair.id, repair.stage.trim().toLowerCase()])
      );
      const openConversations = conversations.filter((thread) => thread.open);
      const approvedCount = openConversations.filter(
        (thread) =>
          thread.linkedRepairId &&
          repairStageById.get(thread.linkedRepairId) === "approved"
      ).length;
      const notApprovedCount = openConversations.filter(
        (thread) =>
          thread.linkedRepairId &&
          repairStageById.get(thread.linkedRepairId) === "not approved"
      ).length;

      setOpenConversationCount(openConversations.length);
      setApprovedConversationCount(approvedCount);
      setNotApprovedConversationCount(notApprovedCount);
    };

    refreshOpenCount();
    window.addEventListener("conversations:changed", refreshOpenCount);
    window.addEventListener("repairs:changed", refreshOpenCount);
    window.addEventListener("storage", refreshOpenCount);

    return () => {
      window.removeEventListener("conversations:changed", refreshOpenCount);
      window.removeEventListener("repairs:changed", refreshOpenCount);
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
    const handleOpenMenu = () => {
      setIsMenuOpen(true);
    };
    const handleCloseMenu = () => {
      setIsMenuOpen(false);
    };

    const desktopQuery = window.matchMedia("(min-width: 769px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mobile-menu:open", handleOpenMenu);
    window.addEventListener("mobile-menu:close", handleCloseMenu);
    desktopQuery.addEventListener("change", closeOnDesktop);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mobile-menu:open", handleOpenMenu);
      window.removeEventListener("mobile-menu:close", handleCloseMenu);
      desktopQuery.removeEventListener("change", closeOnDesktop);
    };
  }, []);

  useEffect(() => {
    const handleGestureContextChange = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      setAllowContextualSwipeOpen(Boolean(detail?.enabled));
    };

    window.addEventListener("mobile-menu:gesture-context", handleGestureContextChange);
    return () => {
      window.removeEventListener("mobile-menu:gesture-context", handleGestureContextChange);
    };
  }, []);

  const supportsSwipeToOpenOnPath =
    pathname === "/dashboard" ||
    pathname === "/templates" ||
    pathname === "/quick-replies" ||
    pathname === "/customers" ||
    pathname === "/settings/advanced" ||
    (pathname === "/work-items" && allowContextualSwipeOpen) ||
    (pathname === "/conversations" && allowContextualSwipeOpen);

  const isInteractiveTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    if (
      target.closest(
        "button, a, input, select, textarea, label, [role='button'], [data-swipe-menu-block='true']"
      )
    ) {
      return true;
    }
    return false;
  };

  const resetSwipeGesture = () => {
    swipeStartRef.current = null;
    swipeGestureIntentRef.current = "pending";
    setMenuOpeningProgress(0);
  };

  const isMobileViewport = () => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  };

  const handleAppTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (isMenuOpen || !supportsSwipeToOpenOnPath || !isMobileViewport()) return;
    const firstTouch = event.touches[0];
    if (!firstTouch) return;
    if (firstTouch.clientX > 24) {
      resetSwipeGesture();
      return;
    }
    if (isInteractiveTarget(event.target)) {
      resetSwipeGesture();
      return;
    }
    swipeStartRef.current = { x: firstTouch.clientX, y: firstTouch.clientY };
    swipeGestureIntentRef.current = "pending";
    setMenuOpeningProgress(0);
  };

  const handleAppTouchMove = (event: TouchEvent<HTMLElement>) => {
    if (isMenuOpen || !supportsSwipeToOpenOnPath || !isMobileViewport()) return;
    const swipeStart = swipeStartRef.current;
    if (!swipeStart) return;

    const movingTouch = event.touches[0];
    if (!movingTouch) return;

    const deltaX = movingTouch.clientX - swipeStart.x;
    const deltaY = movingTouch.clientY - swipeStart.y;

    if (swipeGestureIntentRef.current === "pending") {
      if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
        return;
      }

      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        swipeGestureIntentRef.current = "vertical";
        setMenuOpeningProgress(0);
        return;
      }

      if (deltaX <= 0) {
        setMenuOpeningProgress(0);
        return;
      }

      swipeGestureIntentRef.current = "horizontal";
    }

    if (swipeGestureIntentRef.current !== "horizontal") return;

    if (deltaX <= 0) {
      setMenuOpeningProgress(0);
      return;
    }

    const drawerWidth = Math.min(window.innerWidth * 0.84, 320);
    const progress = Math.min(1, deltaX / drawerWidth);
    setMenuOpeningProgress(progress);
    event.preventDefault();
  };

  const handleAppTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (isMenuOpen || !supportsSwipeToOpenOnPath || !isMobileViewport()) {
      resetSwipeGesture();
      return;
    }

    const swipeStart = swipeStartRef.current;
    const intent = swipeGestureIntentRef.current;
    if (!swipeStart || intent !== "horizontal") {
      resetSwipeGesture();
      return;
    }

    const changedTouch = event.changedTouches[0];
    if (!changedTouch) {
      resetSwipeGesture();
      return;
    }

    const deltaX = changedTouch.clientX - swipeStart.x;
    const deltaY = changedTouch.clientY - swipeStart.y;
    const minHorizontalSwipe = 70;
    const maxVerticalMovement = 56;

    const openedEnough = menuOpeningProgress >= 0.35;
    if (deltaX >= minHorizontalSwipe && Math.abs(deltaY) <= maxVerticalMovement && openedEnough) {
      setIsMenuOpen(true);
    }

    resetSwipeGesture();
  };

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
    const selectedThreadId = window.localStorage.getItem("statusflow.selected-thread-id");
    if (!selectedThreadId) return "/conversations";

    const selectedConversation = readStoredConversations(defaultConversations).find(
      (thread) => thread.id === selectedThreadId
    );

    if (!selectedConversation) return "/conversations";

    return `/conversations?threadId=${selectedConversation.id}`;
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

  const handleRepairStageShortcut = (stageKey: "approved" | "not_approved") => {
    router.push(`/work-items?stage=${stageKey}`);
  };

  return (
    <div
      className={clsx(
        "h-dvh overflow-hidden min-[769px]:grid min-[769px]:transition-[grid-template-columns] min-[769px]:duration-300",
        collapsed ? "min-[769px]:grid-cols-[88px_1fr]" : "min-[769px]:grid-cols-[316px_1fr]"
      )}
      style={{ background: "var(--bg)", color: "var(--text-primary)" }}
    >
      <aside
        className="sticky top-0 hidden h-screen flex-col overflow-y-auto border-r min-[769px]:flex"
        style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
      >
        <div className="border-b px-6 py-5" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-[#25d3c4] p-3 text-[#04243a]">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div className={collapsed ? "hidden" : "block"}>
              <div
                className="text-2xl font-semibold leading-none tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                StatusFlow
              </div>
              <div className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                Communication Platform
              </div>
            </div>
          </div>
        </div>

        <div className={clsx("relative flex-1 py-6", collapsed ? "px-2" : "px-4")}>
          <nav className="space-y-8 pb-16">
            {visibleSections.map((section) => (
              <div key={section.label}>
                <h2
                  className={clsx(
                    "px-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500",
                    collapsed ? "hidden" : "block"
                  )}
                >
                  {section.label}
                </h2>
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
                              return;
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
                          <Icon
                            className={clsx("h-5 w-5", active ? "" : "text-slate-400")}
                            style={active ? { color: "#25d3c4" } : undefined}
                          />
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
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-3)",
              color: "var(--text-secondary)"
            }}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        <div className="border-t p-4" style={{ borderColor: "var(--border)" }}>
          <button
            className="flex w-full items-center justify-center rounded-xl p-3 hover:bg-white/5"
            style={{ color: "var(--text-muted)" }}
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft className={clsx("h-5 w-5 transition-transform", collapsed ? "rotate-180" : "")} />
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 h-full flex-col overflow-hidden">
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
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-3)",
                color: "var(--text-secondary)"
              }}
            >
              <Menu
                className={clsx(
                  "h-5 w-5 transition-transform duration-200",
                  isMenuOpen ? "rotate-90 scale-90" : "rotate-0 scale-100"
                )}
              />
            </button>
            <div className="truncate text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              {impersonatingTenant ?? "AutoGarage De Vries"}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {openConversationCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new Event("conversations:nav-click"));
                  router.push(resolveConversationHref());
                }}
                className="inline-flex items-center gap-1.5 self-center rounded-full border px-2 py-1 text-[11px] font-semibold"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface-3)",
                  color: "var(--text-secondary)"
                }}
                aria-label="View open conversations"
              >
                <span>Open</span>
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/20 px-1 text-[10px] font-bold text-amber-300">
                  {openConversationCount}
                </span>
              </button>
            ) : null}
            {approvedConversationCount > 0 ? (
              <span
                role="button"
                tabIndex={0}
                onClick={() => handleRepairStageShortcut("approved")}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleRepairStageShortcut("approved");
                  }
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 self-center rounded-full border px-2 py-1 text-[11px] font-semibold hover:bg-slate-700/60"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface-3)",
                  color: "var(--text-secondary)"
                }}
                aria-label="View approved repairs"
              >
                <span>Approved</span>
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500/20 px-1 text-[10px] font-bold text-emerald-300">
                  {approvedConversationCount}
                </span>
              </span>
            ) : null}
            {notApprovedConversationCount > 0 ? (
              <span
                role="button"
                tabIndex={0}
                onClick={() => handleRepairStageShortcut("not_approved")}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleRepairStageShortcut("not_approved");
                  }
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 self-center rounded-full border px-2 py-1 text-[11px] font-semibold hover:bg-slate-700/60"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface-3)",
                  color: "var(--text-secondary)"
                }}
                aria-label="View not approved repairs"
              >
                <span>Not Approved</span>
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500/20 px-1 text-[10px] font-bold text-red-300">
                  {notApprovedConversationCount}
                </span>
              </span>
            ) : null}
          </div>
        </header>

        <header
          className="hidden h-[69px] items-center justify-end gap-3 border-b px-6 pr-8 min-[769px]:flex"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
        >
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event("conversations:nav-click"));
              router.push(resolveConversationHref());
            }}
            className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-3)",
              color: "var(--text-secondary)"
            }}
            aria-label="Open conversations page"
          >
            <span className="text-xs tracking-[0.08em] text-slate-400">Open conversations</span>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30">
              {openConversationCount}
            </span>
          </button>
          {approvedConversationCount > 0 ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleRepairStageShortcut("approved")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleRepairStageShortcut("approved");
                }
              }}
              className="flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm hover:bg-slate-700/60"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-3)",
                color: "var(--text-secondary)"
              }}
              aria-label="View approved repairs"
            >
              <span className="text-xs tracking-[0.08em] text-slate-400">Approved</span>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500/20 px-1.5 text-xs font-semibold text-emerald-300">
                {approvedConversationCount}
              </span>
            </div>
          ) : null}
          {notApprovedConversationCount > 0 ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleRepairStageShortcut("not_approved")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleRepairStageShortcut("not_approved");
                }
              }}
              className="flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm hover:bg-slate-700/60"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-3)",
                color: "var(--text-secondary)"
              }}
              aria-label="View not approved repairs"
            >
              <span className="text-xs tracking-[0.08em] text-slate-400">Not Approved</span>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/20 px-1.5 text-xs font-semibold text-red-300">
                {notApprovedConversationCount}
              </span>
            </div>
          ) : null}
          <div
            className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-3)",
              color: "var(--text-secondary)"
            }}
          >
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

        <main
          className="min-h-0 flex-1 overflow-y-auto px-5 py-6 min-[769px]:px-10 min-[769px]:py-8"
          onTouchStart={handleAppTouchStart}
          onTouchMove={handleAppTouchMove}
          onTouchEnd={handleAppTouchEnd}
          onTouchCancel={resetSwipeGesture}
        >
          {children}
        </main>
      </div>

      <MobileMenu
        isOpen={isMenuOpen}
        openingProgress={menuOpeningProgress}
        sections={visibleSections}
        pathname={pathname}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={handleNavLinkClick}
      />
    </div>
  );
}