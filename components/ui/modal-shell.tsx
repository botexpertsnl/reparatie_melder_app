"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

type ModalShellProps = {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
};

/**
 * Standard modal shell for the app.
 * Use this component for every newly added popup.
 */
export function ModalShell({
  title,
  onClose,
  children,
  footer,
  maxWidthClassName = "max-w-2xl",
  closeLabel = "Close dialog",
  closeOnBackdrop = false
}: ModalShellProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  if (!isMounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-[#020810]/70 p-2 backdrop-blur-md sm:items-center sm:p-4"
      onClick={closeOnBackdrop ? (event) => {
        if (event.target === event.currentTarget) onClose();
      } : undefined}
    >
      <div className={clsx("flex h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] shadow-[var(--shadow-lg)] sm:h-auto sm:max-h-[90vh]", maxWidthClassName)}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <h2 className="text-xl font-bold tracking-[-0.025em] text-[var(--text-primary)]">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]" aria-label={closeLabel}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="subtle-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer ? <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] bg-[var(--surface-1)] px-6 py-4">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
