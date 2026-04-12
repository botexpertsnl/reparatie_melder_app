"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, MoreHorizontal, X, Pencil, Trash2, Link2, Unlink2 } from "lucide-react";
import clsx from "clsx";
import { defaultRepairs, readStoredRepairs, writeStoredRepairs, type StoredRepair } from "@/lib/repair-store";
import { RepairDetailsPanel } from "@/components/repairs/repair-details-panel";
import {
  defaultWorkflowStages,
  filterVisibleWorkflowStages,
  readStoredWorkflowStages,
  type StoredWorkflowStage
} from "@/lib/workflow-stage-store";
import {
  defaultConversations,
  readStoredConversations,
  writeStoredConversations,
  type StoredConversation
} from "@/lib/conversation-store";
import { pluralizeLabel, useTenantRepairLabel } from "@/lib/use-tenant-terminology";
import { applyRepairStageChange, type RepairStageChangeOptions } from "@/lib/repair-stage-change";

type RepairItem = StoredRepair;
const UNKNOWN_STAGE = "Unknown";
const SELECTED_REPAIR_STORAGE_KEY = "statusflow.selected-repair-id";

type NewRepairFormValues = {
  customerName: string;
  customerPhone: string;
  assetName: string;
  repairTitle: string;
  description: string;
  repairStage: RepairItem["stage"];
};

const initialFormValues: NewRepairFormValues = {
  customerName: "",
  customerPhone: "+31 ",
  assetName: "",
  repairTitle: "",
  description: "",
  repairStage: "New"
};

function normalizeStageToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "_");
}

function resolveStageFilterFromQuery(
  stageQueryParam: string | null,
  workflowStages: StoredWorkflowStage[],
  filterStages: string[]
) {
  if (!stageQueryParam) return null;
  const normalizedTarget = normalizeStageToken(stageQueryParam);
  const stageByNormalizedName = new Map(
    workflowStages.map((stage) => [normalizeStageToken(stage.name), stage.name])
  );
  const stageByNormalizedKey = new Map(
    workflowStages.map((stage) => [normalizeStageToken(stage.key), stage.name])
  );
  const allFilterStagesByNormalizedName = new Map(
    filterStages.map((stageName) => [normalizeStageToken(stageName), stageName])
  );

  return (
    stageByNormalizedKey.get(normalizedTarget) ??
    stageByNormalizedName.get(normalizedTarget) ??
    allFilterStagesByNormalizedName.get(normalizedTarget) ??
    null
  );
}

function LinkConversationModal({
  conversations,
  onClose,
  onSelect
}: {
  conversations: StoredConversation[];
  onClose: () => void;
  onSelect: (threadId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const filtered = conversations.filter((thread) =>
    `${thread.customerName} ${thread.customerPhone} ${thread.preview}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-[#02050d]/80 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[calc(100dvh-1rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:h-auto sm:max-h-[90vh]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-5">
          <h2 className="text-2xl font-semibold">Link conversation</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-200"
            type="button"
            aria-label="Close link conversation dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="subtle-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <label className="flex items-center gap-2 rounded-xl border border-[#bfc9d8] bg-white px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Search conversations..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="space-y-2">
            {filtered.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => setSelectedThreadId(thread.id)}
                className={clsx(
                  "w-full rounded-xl border bg-white p-3 text-left hover:bg-slate-50",
                  selectedThreadId === thread.id
                    ? "border-[#2fb2a3] ring-2 ring-[#2fb2a3]/20"
                    : "border-[#cdd5e2]"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-800">{thread.customerName || thread.customerPhone}</div>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                    {thread.open ? "Open" : "Closed"}
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-600">{thread.customerPhone}</div>
                <div className="truncate text-sm text-slate-500">{thread.preview}</div>
              </button>
            ))}
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#bfc9d8] bg-white px-3 py-4 text-center text-sm text-slate-500">
                No conversations found.
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[#e2e8f0] bg-[#f4f6fa] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => selectedThreadId && onSelect(selectedThreadId)}
            className={clsx(
              "rounded-xl px-5 py-2 text-sm font-semibold text-white",
              selectedThreadId ? "bg-[#2fb2a3] hover:bg-[#2a9f91]" : "cursor-not-allowed bg-slate-400"
            )}
            disabled={!selectedThreadId}
          >
            Link
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizeRepairStage(stage: string, validStageNames: Set<string>) {
  return validStageNames.has(stage) ? stage : UNKNOWN_STAGE;
}

function matchesRepairSearch(repair: RepairItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return `${repair.title} ${repair.description} ${repair.customerName} ${repair.customerPhone} ${repair.assetName} ${repair.stage}`
    .toLowerCase()
    .includes(normalizedQuery);
}

function StageBadge({
  stage,
  stageColor
}: {
  stage: RepairItem["stage"];
  stageColor?: string;
}) {
  if (stage === UNKNOWN_STAGE) {
    return (
      <span className="inline-flex rounded-xl border border-slate-600 bg-slate-700/20 px-3 py-1 text-sm font-semibold text-slate-300">
        {stage}
      </span>
    );
  }

  if (!stageColor) {
    return (
      <span className="inline-flex rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-300">
        {stage}
      </span>
    );
  }

  return (
    <span
      className="inline-flex rounded-xl px-3 py-1 text-sm font-semibold"
      style={{
        color: stageColor,
        border: `1px solid ${stageColor}66`,
        backgroundColor: `${stageColor}1A`
      }}
    >
      {stage}
    </span>
  );
}

function AddRepairModal({
  mode,
  initialValues,
  stageOptions,
  repairLabel,
  onClose,
  onSubmit
}: {
  mode: "create" | "edit";
  initialValues: NewRepairFormValues;
  stageOptions: string[];
  repairLabel: string;
  onClose: () => void;
  onSubmit: (payload: NewRepairFormValues) => void;
}) {
  const [formValues, setFormValues] = useState<NewRepairFormValues>(initialValues);
  const selectOptions = useMemo(
    () => (stageOptions.includes(formValues.repairStage) ? stageOptions : [...stageOptions, formValues.repairStage]),
    [formValues.repairStage, stageOptions]
  );
  const canSubmit =
    formValues.customerName.trim() &&
    formValues.customerPhone.trim() &&
    formValues.assetName.trim() &&
    formValues.repairTitle.trim() &&
    formValues.description.trim();

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-[#02050d]/80 p-2 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:h-auto sm:max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-5">
          <h2 className="text-2xl font-semibold">
            {mode === "create" ? `New ${repairLabel}` : `Edit ${repairLabel}`}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-200"
            type="button"
            aria-label="Close repair dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="subtle-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) return;
            onSubmit(formValues);
          }}
        >
          <div>
            <label htmlFor="repair-customer-name" className="mb-2 block text-sm font-medium text-slate-700">
              Customer name *
            </label>
            <input
              id="repair-customer-name"
              className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
              placeholder="e.g. John Doe"
              value={formValues.customerName}
              onChange={(event) => setFormValues((prev) => ({ ...prev, customerName: event.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="repair-customer-phone" className="mb-2 block text-sm font-medium text-slate-700">
              Customer phone *
            </label>
            <input
              id="repair-customer-phone"
              className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
              placeholder="+31 6 12345678"
              value={formValues.customerPhone}
              onChange={(event) => setFormValues((prev) => ({ ...prev, customerPhone: event.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="repair-asset" className="mb-2 block text-sm font-medium text-slate-700">
              Device / asset *
            </label>
            <input
              id="repair-asset"
              className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
              placeholder="e.g. iPhone 14 Pro"
              value={formValues.assetName}
              onChange={(event) => setFormValues((prev) => ({ ...prev, assetName: event.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="repair-title" className="mb-2 block text-sm font-medium text-slate-700">
              {repairLabel} title *
            </label>
            <input
              id="repair-title"
              className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
              placeholder="e.g. Screen replacement"
              value={formValues.repairTitle}
              onChange={(event) => setFormValues((prev) => ({ ...prev, repairTitle: event.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="repair-description" className="mb-2 block text-sm font-medium text-slate-700">
              Description *
            </label>
            <textarea
              id="repair-description"
              className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
              placeholder="Describe the issue and any diagnostics."
              value={formValues.description}
              onChange={(event) => setFormValues((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="repair-stage" className="mb-2 block text-sm font-medium text-slate-700">
              Stage
            </label>
            <select
              id="repair-stage"
              className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
              value={formValues.repairStage}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, repairStage: event.target.value as RepairItem["stage"] }))
              }
            >
              {selectOptions.map((stageName) => (
                <option key={stageName}>{stageName}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={clsx(
                "rounded-xl px-5 py-2 text-sm font-semibold text-white",
                canSubmit ? "bg-[#2fb2a3] hover:bg-[#2a9f91]" : "cursor-not-allowed bg-slate-400"
              )}
              disabled={!canSubmit}
            >
              {mode === "create" ? `Create ${repairLabel}` : `Save ${repairLabel}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WorkItemsPageContent() {
  const repairLabel = useTenantRepairLabel();
  const repairLabelPlural = pluralizeLabel(repairLabel);
  const searchParams = useSearchParams();
  const repairIdParam = searchParams.get("repairId");
  const stageParam = searchParams.get("stage");

  const [workflowStages, setWorkflowStages] = useState<StoredWorkflowStage[]>(() =>
    readStoredWorkflowStages(defaultWorkflowStages)
  );
  const visibleWorkflowStages = useMemo(() => filterVisibleWorkflowStages(workflowStages), [workflowStages]);
  const stageNames = useMemo(() => new Set(workflowStages.map((stage) => stage.name)), [workflowStages]);
  const stageColorByName = useMemo(
    () => new Map(workflowStages.map((stage) => [stage.name, stage.color])),
    [workflowStages]
  );
  const stageOptions = useMemo(() => visibleWorkflowStages.map((stage) => stage.name), [visibleWorkflowStages]);
  const initialStage = useMemo(
    () => visibleWorkflowStages.find((stage) => stage.isStart)?.name ?? visibleWorkflowStages[0]?.name ?? UNKNOWN_STAGE,
    [visibleWorkflowStages]
  );

  const [repairs, setRepairs] = useState<RepairItem[]>(() => {
    const stagesAtLoad = readStoredWorkflowStages(defaultWorkflowStages);
    const stageNamesAtLoad = new Set(stagesAtLoad.map((stage) => stage.name));
    return readStoredRepairs(defaultRepairs).map((repair) => ({
      ...repair,
      stage: normalizeRepairStage(repair.stage, stageNamesAtLoad)
    }));
  });
  const [isAddRepairOpen, setIsAddRepairOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStageFilters, setSelectedStageFilters] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingRepairId, setEditingRepairId] = useState<string | null>(null);
  const [deletingRepairId, setDeletingRepairId] = useState<string | null>(null);
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(SELECTED_REPAIR_STORAGE_KEY);
  });
  const [conversations, setConversations] = useState<StoredConversation[]>(() =>
    readStoredConversations(defaultConversations)
  );
  const [openRepairLinkMenu, setOpenRepairLinkMenu] = useState(false);
  const [isLinkConversationOpen, setIsLinkConversationOpen] = useState(false);

  useEffect(() => {
    writeStoredRepairs(repairs);
  }, [repairs]);

  useEffect(() => {
    const refreshWorkflowStages = () => {
      setWorkflowStages(readStoredWorkflowStages(defaultWorkflowStages));
    };

    refreshWorkflowStages();
    window.addEventListener("workflow-stages:changed", refreshWorkflowStages);
    window.addEventListener("storage", refreshWorkflowStages);

    return () => {
      window.removeEventListener("workflow-stages:changed", refreshWorkflowStages);
      window.removeEventListener("storage", refreshWorkflowStages);
    };
  }, []);

  useEffect(() => {
    setRepairs((prev) => prev.map((repair) => ({ ...repair, stage: normalizeRepairStage(repair.stage, stageNames) })));
  }, [stageNames]);

  useEffect(() => {
    if (!repairIdParam) return;
    if (!repairs.some((repair) => repair.id === repairIdParam)) return;
    setSelectedRepairId(repairIdParam);
  }, [repairIdParam, repairs]);

  useEffect(() => {
    if (!selectedRepairId) {
      window.localStorage.removeItem(SELECTED_REPAIR_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(SELECTED_REPAIR_STORAGE_KEY, selectedRepairId);
  }, [selectedRepairId]);

  useEffect(() => {
    if (!selectedRepairId) return;
    const selectedRepairStillExists = repairs.some((repair) => repair.id === selectedRepairId);
    if (!selectedRepairStillExists) {
      setSelectedRepairId(null);
    }
  }, [repairs, selectedRepairId]);

  useEffect(() => {
    const refreshConversations = () => setConversations(readStoredConversations(defaultConversations));
    refreshConversations();
    window.addEventListener("conversations:changed", refreshConversations);
    window.addEventListener("storage", refreshConversations);
    return () => {
      window.removeEventListener("conversations:changed", refreshConversations);
      window.removeEventListener("storage", refreshConversations);
    };
  }, []);

  useEffect(() => {
    const handle = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-action-menu='true']") || target?.closest("[data-repair-link-menu='true']")) return;
      setOpenMenuId(null);
      setOpenRepairLinkMenu(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const editingRepair = repairs.find((repair) => repair.id === editingRepairId) ?? null;
  const deletingRepair = repairs.find((repair) => repair.id === deletingRepairId) ?? null;
  const selectedRepair = useMemo(
    () => repairs.find((repair) => repair.id === selectedRepairId) ?? null,
    [repairs, selectedRepairId]
  );
  const selectedRepairConversation = useMemo(
    () =>
      selectedRepair ? conversations.find((thread) => thread.linkedRepairId === selectedRepair.id) ?? null : null,
    [conversations, selectedRepair]
  );
  const repairsInFilterScope = useMemo(
    () => repairs.filter((repair) => matchesRepairSearch(repair, searchQuery)),
    [repairs, searchQuery]
  );
  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const repair of repairsInFilterScope) {
      counts.set(repair.stage, (counts.get(repair.stage) ?? 0) + 1);
    }
    return counts;
  }, [repairsInFilterScope]);
  const filterStages = useMemo(() => {
    const stageNamesFromRepairs = Array.from(stageCounts.entries())
      .filter(([, count]) => count > 0)
      .map(([stageName]) => stageName)
      .filter((stageName) => !visibleWorkflowStages.some((stage) => stage.name === stageName));
    const visibleConfiguredStages = visibleWorkflowStages
      .map((stage) => stage.name)
      .filter((stageName) => (stageCounts.get(stageName) ?? 0) > 0);
    return [...visibleConfiguredStages, ...stageNamesFromRepairs];
  }, [stageCounts, visibleWorkflowStages]);

  useEffect(() => {
    setSelectedStageFilters((prev) => prev.filter((stageName) => (stageCounts.get(stageName) ?? 0) > 0));
  }, [stageCounts]);

  useEffect(() => {
    if (!stageParam) return;
    const resolvedStageName = resolveStageFilterFromQuery(stageParam, workflowStages, filterStages);
    setSelectedStageFilters(resolvedStageName ? [resolvedStageName] : []);
  }, [filterStages, stageParam, workflowStages]);

  const activeStageFilters = useMemo(
    () =>
      filterStages.filter((stageName) => {
        const normalizedStage = stageName.trim().toLowerCase();
        return normalizedStage !== "completed" && normalizedStage !== "cancelled" && normalizedStage !== "canceled";
      }),
    [filterStages]
  );
  const filteredRepairs = useMemo(() => {
    return repairs.filter((repair) => {
      const matchesSearch = matchesRepairSearch(repair, searchQuery);
      const matchesStageFilter =
        selectedStageFilters.length === 0 || selectedStageFilters.includes(repair.stage);
      return matchesSearch && matchesStageFilter;
    });
  }, [repairs, searchQuery, selectedStageFilters]);

  const toggleStageFilter = (stageName: string) => {
    setSelectedStageFilters((prev) =>
      prev.includes(stageName) ? prev.filter((selected) => selected !== stageName) : [...prev, stageName]
    );
  };
  const selectActiveTaskFilters = () => {
    setSelectedStageFilters(activeStageFilters);
  };
  const clearAllStageFilters = () => {
    setSelectedStageFilters([]);
  };

  const handleCreateRepair = (payload: NewRepairFormValues) => {
    const newRepair = {
      id: `repair_${Date.now()}`,
      title: payload.repairTitle,
      description: payload.description,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      assetName: payload.assetName,
      stage: payload.repairStage,
      priority: "Medium" as const,
      status: "Open" as const
    };
    setRepairs((prev) => [newRepair, ...prev]);
    setSelectedRepairId(newRepair.id);
    setIsAddRepairOpen(false);
  };

  const handleEditRepair = (repairId: string, payload: NewRepairFormValues) => {
    setRepairs((prev) =>
      prev.map((repair) =>
        repair.id === repairId
          ? {
              ...repair,
              title: payload.repairTitle,
              description: payload.description,
              customerName: payload.customerName,
              customerPhone: payload.customerPhone,
              assetName: payload.assetName,
              stage: payload.repairStage
            }
          : repair
      )
    );
    setEditingRepairId(null);
  };

  const toFormValues = (repair: RepairItem): NewRepairFormValues => ({
    customerName: repair.customerName,
    customerPhone: repair.customerPhone,
    assetName: repair.assetName,
    repairTitle: repair.title,
    description: repair.description,
    repairStage: repair.stage
  });

  const availableConversations = useMemo(
    () => conversations.filter((thread) => !thread.linkedRepairId || thread.linkedRepairId === selectedRepairId),
    [conversations, selectedRepairId]
  );

  const linkConversationToRepair = (threadId: string, repairId: string) => {
    const updated = conversations.map((thread) => {
      if (thread.id === threadId) return { ...thread, linkedRepairId: repairId };
      if (thread.linkedRepairId === repairId) return { ...thread, linkedRepairId: undefined };
      return thread;
    });
    setConversations(updated);
    writeStoredConversations(updated);
    setOpenRepairLinkMenu(false);
    setIsLinkConversationOpen(false);
  };

  const unlinkConversationFromRepair = (repairId: string) => {
    const updated = conversations.map((thread) =>
      thread.linkedRepairId === repairId ? { ...thread, linkedRepairId: undefined } : thread
    );
    setConversations(updated);
    writeStoredConversations(updated);
    setOpenRepairLinkMenu(false);
  };

  const updateRepairStage = (repairId: string, stageName: string, options?: RepairStageChangeOptions) => {
    const result = applyRepairStageChange({
      repairs,
      conversations,
      repairId,
      stageName,
      options
    });
    setRepairs(result.repairs);
    setConversations(result.conversations);
    writeStoredConversations(result.conversations);
  };

  return (
    <>
      <div
        className={`-mx-5 -my-6 grid h-[calc(100dvh-69px)] transition-[grid-template-columns] duration-300 md:-mx-10 md:-my-8 md:h-[calc(100vh-69px)] ${
          selectedRepair ? "grid-cols-[1fr_380px]" : "grid-cols-[1fr]"
        }`}
        style={{ background: "var(--bg)" }}
      >
        <div className="flex min-h-0 flex-col pb-6 pt-0 md:pb-8 md:pt-0">
          <div className="mb-5 space-y-4 px-4 py-4 md:mb-7 md:px-10 md:py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold text-white">{repairLabelPlural}</h1>
              <div className="flex w-full sm:w-auto">
                <button
                  onClick={() => setIsAddRepairOpen(true)}
                  className="inline-flex h-11 items-center justify-center gap-3 whitespace-nowrap rounded-xl bg-[var(--surface-3)] px-5 text-sm font-semibold text-[var(--text-primary)]"
                >
                  <Plus className="h-5 w-5" />
                  New {repairLabel}
                </button>
              </div>
            </div>
            <label
              className="flex h-11 w-full max-w-56 items-center gap-3 rounded-xl border px-4 text-sm text-slate-300"
              style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
            >
              <Search className="h-5 w-5 text-slate-500" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
                placeholder={`Search ${repairLabelPlural.toLowerCase()}...`}
                aria-label={`Search ${repairLabelPlural.toLowerCase()}`}
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectActiveTaskFilters}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:text-white"
              >
                Active tasks
              </button>
              <button
                type="button"
                onClick={clearAllStageFilters}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:text-white"
              >
                De-select all
              </button>
              {filterStages.map((stageName) => {
                const isActive = selectedStageFilters.includes(stageName);
                return (
                  <button
                    key={stageName}
                    type="button"
                    onClick={() => toggleStageFilter(stageName)}
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      isActive ? "text-white" : "text-slate-300"
                    )}
                    style={{
                      borderColor: isActive ? (stageColorByName.get(stageName) ?? "var(--text-primary)") : "var(--border)",
                      background: isActive ? `${stageColorByName.get(stageName) ?? "#30b5a5"}24` : "var(--surface-1)"
                    }}
                  >
                    <span>{stageName}</span>
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-[11px]",
                        isActive ? "bg-white/20 text-white" : "bg-slate-700/70 text-slate-200"
                      )}
                    >
                      {stageCounts.get(stageName) ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="min-h-0 flex-1 overflow-hidden">
            <div
              className={`h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden border ${
                selectedRepair ? "border-r-0" : ""
              }`}
              style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
            >
              <table className="w-full table-fixed">
                <thead className="border-b border-[#253149] text-left text-sm text-slate-400">
                  <tr>
                    <th className="w-[42%] px-5 py-4">Title</th>
                    <th className="w-[28%] px-5 py-4">Customer</th>
                    <th className="w-[24%] px-5 py-4 pr-3">Stage</th>
                    <th className="w-[6%] py-4 pl-2 pr-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRepairs.map((repair) => (
                    <tr
                      key={repair.id}
                      onClick={() => setSelectedRepairId(repair.id)}
                      className={`border-b border-[#253149] last:border-b-0 ${
                        selectedRepairId === repair.id ? "bg-white/10" : ""
                      }`}
                    >
                      <td className="px-5 py-4 align-middle">
                        <button
                          type="button"
                          className="w-full min-w-0 text-left"
                          onClick={() => setSelectedRepairId(repair.id)}
                        >
                          <div className="truncate text-base font-semibold leading-tight text-white transition-colors hover:text-[#25d3c4]">
                            {repair.title}
                          </div>
                          <div className="mt-1 truncate text-sm text-slate-500">
                            {repair.assetName} · {repair.description}
                          </div>
                        </button>
                      </td>
                      <td className="truncate px-5 py-4 align-middle text-base font-medium text-white">
                        {repair.customerName}
                      </td>
                      <td className="px-5 py-4 pr-3 align-middle">
                        <StageBadge stage={repair.stage} stageColor={stageColorByName.get(repair.stage)} />
                      </td>
                      <td
                        className={`relative py-4 pl-2 align-middle text-right text-slate-400 ${
                          selectedRepair ? "pr-6" : "pr-3"
                        }`}
                      >
                        <button
                          data-action-menu="true"
                          className="rounded-md p-2 hover:bg-slate-800/70"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenuId((prev) => (prev === repair.id ? null : repair.id));
                          }}
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                        {openMenuId === repair.id ? (
                          <div
                            data-action-menu="true"
                            className={`absolute top-12 z-10 w-32 rounded-xl border border-[#d7dce3] bg-[#f4f6fa] p-1 text-left shadow-xl ${
                              selectedRepair ? "right-4" : "right-2"
                            }`}
                          >
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
                              onClick={() => {
                                setEditingRepairId(repair.id);
                                setOpenMenuId(null);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                              onClick={() => {
                                setDeletingRepairId(repair.id);
                                setOpenMenuId(null);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {filteredRepairs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">
                        No {repairLabelPlural.toLowerCase()} found for the current search and filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {selectedRepair ? (
          <div
            className="relative h-full min-h-0 overflow-hidden border-l"
            style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
          >
            <RepairDetailsPanel
              repair={selectedRepair}
              itemLabel={repairLabel}
              onClose={() => setSelectedRepairId(null)}
              onStageChange={(stageName, options) => updateRepairStage(selectedRepair.id, stageName, options)}
              onLinkChange={() => setOpenRepairLinkMenu((prev) => !prev)}
              onLinkAriaLabel={selectedRepairConversation ? "Change linked conversation" : "Link conversation"}
              isLinkActive={Boolean(selectedRepairConversation)}
              linkedConversationHref={
                selectedRepairConversation ? `/conversations?threadId=${selectedRepairConversation.id}` : undefined
              }
              className="h-full min-h-0 py-5 pl-6 pr-5"
            />
            {openRepairLinkMenu ? (
              <div
                data-repair-link-menu="true"
                className="absolute bottom-16 right-5 z-20 w-52 rounded-xl border border-[#d7dce3] bg-[#f4f6fa] p-1 text-left shadow-xl"
              >
                {selectedRepairConversation ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
                    onClick={() => (selectedRepair ? unlinkConversationFromRepair(selectedRepair.id) : null)}
                  >
                    <Unlink2 className="h-4 w-4" />
                    Unlink conversation
                  </button>
                ) : null}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
                  onClick={() => {
                    setIsLinkConversationOpen(true);
                    setOpenRepairLinkMenu(false);
                  }}
                >
                  <Link2 className="h-4 w-4" />
                  {selectedRepairConversation ? "Link other conversation" : "Link conversation"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {isAddRepairOpen ? (
        <AddRepairModal
          mode="create"
          initialValues={{ ...initialFormValues, repairStage: initialStage }}
          stageOptions={stageOptions}
          repairLabel={repairLabel}
          onClose={() => setIsAddRepairOpen(false)}
          onSubmit={handleCreateRepair}
        />
      ) : null}

      {editingRepair ? (
        <AddRepairModal
          mode="edit"
          initialValues={toFormValues(editingRepair)}
          stageOptions={stageOptions}
          repairLabel={repairLabel}
          onClose={() => setEditingRepairId(null)}
          onSubmit={(values) => handleEditRepair(editingRepair.id, values)}
        />
      ) : null}

      {deletingRepair ? (
        <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-[#02050d]/80 p-2 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] p-6 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Delete repair</h2>
              <button
                type="button"
                onClick={() => setDeletingRepairId(null)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-200"
                aria-label="Close delete repair dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete <span className="font-semibold">{deletingRepair.title}</span>?
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingRepairId(null)}
                className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setRepairs((prev) => prev.filter((repair) => repair.id !== deletingRepair.id));
                  if (selectedRepairId === deletingRepair.id) setSelectedRepairId(null);
                  setDeletingRepairId(null);
                }}
                className="rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isLinkConversationOpen && selectedRepair ? (
        <LinkConversationModal
          conversations={availableConversations}
          onClose={() => setIsLinkConversationOpen(false)}
          onSelect={(threadId) => linkConversationToRepair(threadId, selectedRepair.id)}
        />
      ) : null}
    </>
  );
}

function WorkItemsPageFallback() {
  return (
    <div
      className="-mx-5 -my-6 flex h-[calc(100dvh-69px)] items-center justify-center md:-mx-10 md:-my-8 md:h-[calc(100vh-69px)]"
      style={{ background: "var(--bg)" }}
    >
      <div className="text-sm text-slate-400">Loading work items...</div>
    </div>
  );
}

export default function WorkItemsPage() {
  return (
    <Suspense fallback={<WorkItemsPageFallback />}>
      <WorkItemsPageContent />
    </Suspense>
  );
}
