import { ChevronRight, Link as LinkIcon, Wrench, X } from "lucide-react";
import type { StoredRepair } from "@/lib/repair-store";

type RepairDetailsPanelProps = {
  repair: StoredRepair;
  itemLabel?: string;
  onClose?: () => void;
  onLinkChange?: () => void;
  onLinkAriaLabel?: string;
  isLinkActive?: boolean;
  className?: string;
};

export function RepairDetailsPanel({
  repair,
  itemLabel = "Repair",
  onClose,
  onLinkChange,
  onLinkAriaLabel = "Change linked repair",
  isLinkActive = true,
  className,
}: RepairDetailsPanelProps) {
  return (
    <aside className={className ?? "relative border-l border-[#253149] bg-[#0b1221] px-5 py-5"}>
      <div className="mb-4 flex items-center justify-between">
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
      <h3 className="text-2xl font-semibold text-white">{repair.title}</h3>
      <div className="mt-2 text-sm text-slate-400">{repair.customerName} · {repair.assetName}</div>
      <div className="mt-4 border-t border-[#253149] pt-4 text-sm text-slate-300">{repair.description}</div>
      <div className="mt-5 space-y-2">
        {["Diagnosing", "Repairing", "Ready for Pickup"].map((step) => (
          <button key={step} type="button" className="flex w-full items-center justify-between rounded-xl border border-[#253149] px-3 py-2 text-left text-sm text-slate-200 hover:bg-[#182236]">
            {step}
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>
        ))}
      </div>
      {onLinkChange ? (
        <button
          type="button"
          onClick={onLinkChange}
          className={`absolute bottom-5 right-5 ${isLinkActive ? "text-[#69f0df] hover:text-[#25d3c4]" : "text-slate-500 hover:text-slate-300"}`}
          aria-label={onLinkAriaLabel}
        >
          <LinkIcon className="h-5 w-5" />
        </button>
      ) : null}
    </aside>
  );
}
