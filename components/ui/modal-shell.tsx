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
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-[#02050d]/80 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={closeOnBackdrop ? (event) => {
        if (event.target === event.currentTarget) onClose();
      } : undefined}
    >
      <div className={clsx("flex h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:h-auto sm:max-h-[90vh]", maxWidthClassName)}>
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-5">
          <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-900 hover:bg-slate-200" aria-label={closeLabel}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="subtle-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer ? <div className="flex items-center justify-end gap-3 border-t border-[#e2e8f0] bg-[#f4f6fa] px-6 py-4">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
