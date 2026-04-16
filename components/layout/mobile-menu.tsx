"use client";

import { useRef, type TouchEvent } from "react";
import clsx from "clsx";
import { MessageSquareText, type LucideIcon } from "lucide-react";

export type NavSection = {
  label: string;
  items: Array<{
    name: string;
    href: string;
    icon: LucideIcon;
  }>;
};

type MobileMenuProps = {
  isOpen: boolean;
  openingProgress?: number;
  sections: NavSection[];
  pathname: string;
  onClose: () => void;
  onNavigate: (href: string) => void;
};

export function MobileMenu({
  isOpen,
  openingProgress = 0,
  sections,
  pathname,
  onClose,
  onNavigate
}: MobileMenuProps) {
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const firstTouch = event.touches[0];
    if (!firstTouch) return;
    touchStartXRef.current = firstTouch.clientX;
    touchStartYRef.current = firstTouch.clientY;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (!isOpen) return;
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    if (startX === null || startY === null) return;

    const changedTouch = event.changedTouches[0];
    if (!changedTouch) return;

    const deltaX = changedTouch.clientX - startX;
    const deltaY = changedTouch.clientY - startY;
    const minHorizontalSwipe = 70;
    const maxVerticalMovement = 50;

    if (
      Math.abs(deltaX) < minHorizontalSwipe ||
      Math.abs(deltaY) > maxVerticalMovement ||
      deltaX > 0
    ) {
      return;
    }

    onClose();
  };

  const clampedProgress = Math.min(1, Math.max(0, openingProgress));
  const effectiveProgress = isOpen ? 1 : clampedProgress;
  const isDraggingOpen = !isOpen && clampedProgress > 0;

  return (
    <div
      className={clsx(
        "fixed inset-0 z-50 max-[768px]:block min-[769px]:hidden",
        isOpen || isDraggingOpen ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!isOpen}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        className={clsx(
          "absolute inset-0 bg-black/45",
          isDraggingOpen ? "transition-none" : "transition-opacity duration-300"
        )}
        style={{ opacity: effectiveProgress }}
        onClick={onClose}
        aria-label="Close menu"
      />

      <aside
        className={clsx(
          "absolute left-0 top-0 h-full w-[84%] max-w-[320px] border-r px-5 py-6 shadow-2xl",
          isDraggingOpen ? "transition-none" : "transition-transform duration-300"
        )}
        style={{
          borderColor: "var(--border)",
          background: "var(--surface-1)",
          transform: `translateX(${(effectiveProgress - 1) * 100}%)`
        }}
      >
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-xl bg-[#25d3c4] p-2.5 text-[#04243a]">
            <MessageSquareText className="h-4 w-4" />
          </div>
          <div className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            StatusFlow
          </div>
        </div>

        <nav className="space-y-7">
          {sections.map((section) => (
            <div key={section.label}>
              <h2 className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{section.label}</h2>
              <ul className="mt-3 space-y-1.5">
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate(item.href);
                          onClose();
                        }}
                        className={clsx(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-medium transition",
                          active ? "bg-white/10" : "hover:bg-slate-900/70"
                        )}
                        style={{ color: active ? "#25d3c4" : "var(--text-secondary)" }}
                      >
                        <Icon className="h-5 w-5" style={{ color: active ? "#25d3c4" : "var(--text-muted)" }} />
                        {item.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </div>
  );
}
