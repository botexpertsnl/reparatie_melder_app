"use client";

import { useEffect, useMemo, useState } from "react";
import { Link as LinkIcon, MessageSquare, Wrench, X } from "lucide-react";
import type { StoredRepair } from "@/lib/repair-store";
import { defaultWorkflowStages, readStoredWorkflowStages, type StoredWorkflowStage } from "@/lib/workflow-stage-store";

type RepairDetailsPanelProps = {
  repair: StoredRepair;
  itemLabel?: string;
  onClose?: () => void;
  onLinkChange?: () => void;
  onLinkAriaLabel?: string;
  isLinkActive?: boolean;
  linkedConversationHref?: string;
  className?: string;
};

export function RepairDetailsPanel({
  repair,
  itemLabel = "Repair",
  onClose,
  onLinkChange,
  onLinkAriaLabel = "Change linked repair",
  isLinkActive = true,
  linkedConversationHref,
  className,
}: RepairDetailsPanelProps) {
  const [workflowStages, setWorkflowStages] = useState<StoredWorkflowStage[]>(() =>
    readStoredWorkflowStages(defaultWorkflowStages)
  );

  useEffect(() => {
    const refreshWorkflowStages = () => {
      setWorkflowStages(readStoredWorkflowStages(defaultWorkflowStages));
    };

    refreshWorkflowStages();
    window.addEventListener("workflow-stages:changed", refreshWorkflowStages);

    return () => {
      window.removeEventListener("workflow-stages:changed", refreshWorkflowStages);
    };
  }, []);

  const currentStageIndex = useMemo(
    () => workflowStages.findIndex((stage) => stage.name === repair.stage),
    [repair.stage, workflowStages]
  );

  return (
    <aside
      className={`relative flex h-full max-h-full min-h-0 flex-col border-l px-5 py-5 ${className ?? ""}`}
      style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
    >
      <div className="mb-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-xl font-semibold text-white">
          <Wrench className="h-5 w-5 text-[#25d3c4]" />
          {itemLabel} Details
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-[#182236] hover:text-white"
            aria-label="Hide repair details"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <h3 className="text-2xl font-semibold text-white">{repair.title}</h3>
        <div className="mt-2 text-sm text-slate-400">{repair.customerName} · {repair.assetName}</div>
        {onLinkChange || linkedConversationHref ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {linkedConversationHref ? (
              <a
                href={linkedConversationHref}
                className="inline-flex items-center gap-2 rounded-md border border-[#253149] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#182236]"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Open conversation
              </a>
            ) : null}
            {onLinkChange ? (
              <button
                type="button"
                onClick={onLinkChange}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#253149] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#182236]"
                aria-label={onLinkAriaLabel}
              >
                <LinkIcon className={`h-3.5 w-3.5 ${isLinkActive ? "text-[#69f0df]" : "text-slate-500"}`} />
                {linkedConversationHref ? "Change link" : "Link conversation"}
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 border-t border-[#253149] pt-4 text-sm text-slate-300">{repair.description}</div>
        <div className="mt-5 space-y-2">
          {workflowStages.map((stage, index) => {
          const isCurrent = index === currentStageIndex;
          const isPrevious = currentStageIndex >= 0 && index < currentStageIndex;
          const isUpcoming = currentStageIndex < 0 || index > currentStageIndex;

          return (
            <div
              key={stage.id}
              className="flex w-full cursor-default items-center gap-2.5 rounded-2xl border border-[#253149] bg-[#121b2b]/65 px-3 py-2.5 text-left text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] hover:shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
              style={isPrevious
                ? {
                  opacity: 0.55
                }
                : isCurrent
                  ? {
                    borderColor: stage.color,
                    boxShadow: `0 0 0 1px ${stage.color} inset`
                  }
                  : isUpcoming
                    ? {
                      opacity: 0.9
                    }
                    : undefined}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
              <span className="text-sm font-semibold text-white">{stage.name}</span>
            </div>
          );
          })}
        </div>
      </div>
    </aside>
  );
}
