"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, ChevronDown, MoreHorizontal, X, Pencil, Trash2, Link2, Unlink2 } from "lucide-react";
import clsx from "clsx";
import { defaultRepairs, readStoredRepairs, writeStoredRepairs, type StoredRepair } from "@/lib/repair-store";
import { RepairDetailsPanel } from "@/components/repairs/repair-details-panel";
import { defaultWorkflowStages, readStoredWorkflowStages, type StoredWorkflowStage } from "@/lib/workflow-stage-store";
import { defaultConversations, readStoredConversations, writeStoredConversations, type StoredConversation } from "@/lib/conversation-store";
import { pluralizeLabel, useTenantRepairLabel } from "@/lib/use-tenant-terminology";

type RepairItem = StoredRepair;
const UNKNOWN_STAGE = "Unknown";

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
  const filtered = conversations.filter((thread) => `${thread.customerName} ${thread.customerPhone} ${thread.preview}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] p-6 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Link conversation</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-200" type="button" aria-label="Close link conversation dialog"><X className="h-5 w-5" /></button>
        </div>

        <label className="mb-4 flex items-center gap-2 rounded-xl border border-[#bfc9d8] bg-white px-3 py-2">
          <Search className="h-4 w-4 text-slate-500" />
          <input className="w-full bg-transparent text-sm outline-none" placeholder="Search conversations..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>

        <div className="space-y-2">
          {filtered.map((thread) => (
            <button key={thread.id} type="button" onClick={() => onSelect(thread.id)} className="w-full rounded-xl border border-[#cdd5e2] bg-white p-3 text-left hover:bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-800">{thread.customerName || thread.customerPhone}</div>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">{thread.open ? "Open" : "Closed"}</span>
              </div>
              <div className="mt-1 text-sm text-slate-600">{thread.customerPhone}</div>
              <div className="truncate text-sm text-slate-500">{thread.preview}</div>
            </button>
          ))}
          {filtered.length === 0 ? <div className="rounded-xl border border-dashed border-[#bfc9d8] bg-white px-3 py-4 text-center text-sm text-slate-500">No conversations found.</div> : null}
        </div>
      </div>
    </div>
  );
}

function normalizeRepairStage(stage: string, validStageNames: Set<string>) {
  return validStageNames.has(stage) ? stage : UNKNOWN_STAGE;
}

function StageBadge({ stage }: { stage: RepairItem["stage"] }) {
  if (stage === UNKNOWN_STAGE) {
    return <span className="inline-flex rounded-xl border border-slate-600 bg-slate-700/20 px-3 py-1 text-sm font-semibold text-slate-300">{stage}</span>;
  }
  if (stage === "Awaiting Approval") {
    return <span className="inline-flex rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-sm font-semibold text-orange-400">{stage}</span>;
  }
  if (stage === "New") {
    return <span className="inline-flex rounded-xl border border-slate-700 bg-slate-700/20 px-3 py-1 text-sm font-semibold text-slate-300">{stage}</span>;
  }
  return <span className="inline-flex rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-300">{stage}</span>;
}

function ChangeStageModal({
  repair,
  stageOptions,
  onClose,
  onSubmit
}: {
  repair: RepairItem;
  stageOptions: string[];
  onClose: () => void;
  onSubmit: (stage: RepairItem["stage"]) => void;
}) {
  const [selectedStage, setSelectedStage] = useState<RepairItem["stage"]>(repair.stage);
  const selectOptions = useMemo(
    () => (stageOptions.includes(selectedStage) ? stageOptions : [...stageOptions, selectedStage]),
    [selectedStage, stageOptions]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] p-6 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Change stage</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-200" type="button" aria-label="Close stage dialog"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Update the stage for <span className="font-semibold">{repair.title}</span>.
        </p>
        <label htmlFor="change-repair-stage" className="mb-2 block text-sm font-medium text-slate-700">Stage</label>
        <select id="change-repair-stage" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]" value={selectedStage} onChange={(event) => setSelectedStage(event.target.value as RepairItem["stage"])}>
          {selectOptions.map((stageName) => (
            <option key={stageName}>{stageName}</option>
          ))}
        </select>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
          <button type="button" onClick={() => onSubmit(selectedStage)} className="rounded-xl bg-[#2fb2a3] px-5 py-2 text-sm font-semibold text-white hover:bg-[#2a9f91]">Save stage</button>
        </div>
      </div>
    </div>
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
  const canSubmit = formValues.customerName.trim() && formValues.customerPhone.trim() && formValues.assetName.trim() && formValues.repairTitle.trim() && formValues.description.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="text-2xl font-semibold">{mode === "create" ? `New ${repairLabel}` : `Edit ${repairLabel}`}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-200" type="button" aria-label="Close repair dialog"><X className="h-5 w-5" /></button>
        </div>

        <form className="space-y-5 px-6 pb-6" onSubmit={(event) => { event.preventDefault(); if (!canSubmit) return; onSubmit(formValues); }}>
          <div>
            <label htmlFor="repair-customer-name" className="mb-2 block text-sm font-medium text-slate-700">Customer name *</label>
            <input id="repair-customer-name" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]" placeholder="e.g. John Doe" value={formValues.customerName} onChange={(event) => setFormValues((prev) => ({ ...prev, customerName: event.target.value }))} />
          </div>
          <div>
            <label htmlFor="repair-customer-phone" className="mb-2 block text-sm font-medium text-slate-700">Customer phone *</label>
            <input id="repair-customer-phone" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]" placeholder="+31 6 12345678" value={formValues.customerPhone} onChange={(event) => setFormValues((prev) => ({ ...prev, customerPhone: event.target.value }))} />
          </div>
          <div>
            <label htmlFor="repair-asset" className="mb-2 block text-sm font-medium text-slate-700">Device / asset *</label>
            <input id="repair-asset" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]" placeholder="e.g. iPhone 14 Pro" value={formValues.assetName} onChange={(event) => setFormValues((prev) => ({ ...prev, assetName: event.target.value }))} />
          </div>
          <div>
            <label htmlFor="repair-title" className="mb-2 block text-sm font-medium text-slate-700">{repairLabel} title *</label>
            <input id="repair-title" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]" placeholder="e.g. Screen replacement" value={formValues.repairTitle} onChange={(event) => setFormValues((prev) => ({ ...prev, repairTitle: event.target.value }))} />
          </div>
          <div>
            <label htmlFor="repair-description" className="mb-2 block text-sm font-medium text-slate-700">Description *</label>
            <textarea id="repair-description" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]" placeholder="Describe the issue and any diagnostics." value={formValues.description} onChange={(event) => setFormValues((prev) => ({ ...prev, description: event.target.value }))} />
          </div>

          <div>
            <label htmlFor="repair-stage" className="mb-2 block text-sm font-medium text-slate-700">Stage</label>
            <select id="repair-stage" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]" value={formValues.repairStage} onChange={(event) => setFormValues((prev) => ({ ...prev, repairStage: event.target.value as RepairItem["stage"] }))}>
              {selectOptions.map((stageName) => (
                <option key={stageName}>{stageName}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
            <button type="submit" className={clsx("rounded-xl px-5 py-2 text-sm font-semibold text-white", canSubmit ? "bg-[#2fb2a3] hover:bg-[#2a9f91]" : "cursor-not-allowed bg-slate-400")} disabled={!canSubmit}>{mode === "create" ? `Create ${repairLabel}` : `Save ${repairLabel}`}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WorkItemsPage() {
  const repairLabel = useTenantRepairLabel();
  const repairLabelPlural = pluralizeLabel(repairLabel);
  const [workflowStages, setWorkflowStages] = useState<StoredWorkflowStage[]>(() => readStoredWorkflowStages(defaultWorkflowStages));
  const stageNames = useMemo(() => new Set(workflowStages.map((stage) => stage.name)), [workflowStages]);
  const stageOptions = useMemo(() => workflowStages.map((stage) => stage.name), [workflowStages]);
  const initialStage = useMemo(
    () => workflowStages.find((stage) => stage.isStart)?.name ?? workflowStages[0]?.name ?? UNKNOWN_STAGE,
    [workflowStages]
  );

  const [repairs, setRepairs] = useState<RepairItem[]>(() => {
    const stagesAtLoad = readStoredWorkflowStages(defaultWorkflowStages);
    const stageNamesAtLoad = new Set(stagesAtLoad.map((stage) => stage.name));
    return readStoredRepairs(defaultRepairs).map((repair) => ({ ...repair, stage: normalizeRepairStage(repair.stage, stageNamesAtLoad) }));
  });
  const [isAddRepairOpen, setIsAddRepairOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingRepairId, setEditingRepairId] = useState<string | null>(null);
  const [deletingRepairId, setDeletingRepairId] = useState<string | null>(null);
  const [changingStageRepairId, setChangingStageRepairId] = useState<string | null>(null);
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<StoredConversation[]>(() => readStoredConversations(defaultConversations));
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
  const selectedRepair = useMemo(() => repairs.find((repair) => repair.id === selectedRepairId) ?? null, [repairs, selectedRepairId]);
  const selectedRepairConversation = useMemo(
    () =>
      selectedRepair
        ? conversations.find((thread) => thread.linkedRepairId === selectedRepair.id) ?? null
        : null,
    [conversations, selectedRepair]
  );
  const stageChangingRepair = repairs.find((repair) => repair.id === changingStageRepairId) ?? null;

  const handleCreateRepair = (payload: NewRepairFormValues) => {
    const newRepair = { id: `repair_${Date.now()}`, title: payload.repairTitle, description: payload.description, customerName: payload.customerName, customerPhone: payload.customerPhone, assetName: payload.assetName, stage: payload.repairStage, priority: "Medium" as const, status: "Open" as const };
    setRepairs((prev) => [newRepair, ...prev]);
    setSelectedRepairId(newRepair.id);
    setIsAddRepairOpen(false);
  };

  const handleEditRepair = (repairId: string, payload: NewRepairFormValues) => {
    setRepairs((prev) => prev.map((repair) => (repair.id === repairId ? { ...repair, title: payload.repairTitle, description: payload.description, customerName: payload.customerName, customerPhone: payload.customerPhone, assetName: payload.assetName, stage: payload.repairStage } : repair)));
    setEditingRepairId(null);
  };
  const handleChangeRepairStage = (repairId: string, stage: RepairItem["stage"]) => {
    setRepairs((prev) => prev.map((repair) => (repair.id === repairId ? { ...repair, stage } : repair)));
    setChangingStageRepairId(null);
  };

  const toFormValues = (repair: RepairItem): NewRepairFormValues => ({ customerName: repair.customerName, customerPhone: repair.customerPhone, assetName: repair.assetName, repairTitle: repair.title, description: repair.description, repairStage: repair.stage });
  const availableConversations = useMemo(() => conversations.filter((thread) => !thread.linkedRepairId || thread.linkedRepairId === selectedRepairId), [conversations, selectedRepairId]);

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
    const updated = conversations.map((thread) => (thread.linkedRepairId === repairId ? { ...thread, linkedRepairId: undefined } : thread));
    setConversations(updated);
    writeStoredConversations(updated);
    setOpenRepairLinkMenu(false);
  };

  return (
    <>
      <div
        className={`-mx-10 -my-8 grid h-[calc(100vh-69px)] transition-[grid-template-columns] duration-300 ${selectedRepair ? "grid-cols-[1fr_380px]" : "grid-cols-[1fr]"}`}
        style={{ background: "var(--bg)" }}
      >
        <div className="flex min-h-0 flex-col py-8">
          <div
            className="mb-7 flex flex-wrap items-start justify-between gap-4 border-y px-10 py-5"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            <div><h1 className="text-2xl font-semibold text-white">{repairLabelPlural}</h1><p className="mt-1 text-sm text-slate-400">Manage ongoing {repairLabelPlural.toLowerCase()}</p></div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <button className="inline-flex h-11 min-w-40 items-center justify-between rounded-xl border px-4 text-sm text-slate-400" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>All<ChevronDown className="ml-4 h-5 w-5" /></button>
              <label className="flex h-11 min-w-72 items-center gap-3 rounded-xl border px-4 text-sm text-slate-400" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}><Search className="h-5 w-5" /><span className="text-sm">Search...</span></label>
              <button onClick={() => setIsAddRepairOpen(true)} className="inline-flex h-11 items-center gap-3 rounded-xl bg-[var(--surface-3)] px-5 text-sm font-semibold text-[var(--text-primary)]"><Plus className="h-5 w-5" />New {repairLabel}</button>
            </div>
          </div>

          <section className="min-h-0 flex-1 overflow-hidden">
            <div
              className={`h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden border ${selectedRepair ? "border-r-0" : ""}`}
              style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
            >
            <table className="w-full table-fixed">
              <thead className="border-b border-[#253149] text-left text-sm text-slate-400"><tr><th className="w-[42%] px-5 py-4">Title</th><th className="w-[28%] px-5 py-4">Customer</th><th className="w-[24%] px-5 py-4">Stage</th><th className="w-[6%] px-5 py-4 pr-2" /></tr></thead>
              <tbody>
                {repairs.map((repair) => (
                  <tr
                    key={repair.id}
                    onClick={() => setSelectedRepairId(repair.id)}
                    className={`border-b border-[#253149] last:border-b-0 ${selectedRepairId === repair.id ? "bg-white/10" : ""}`}
                  >
                    <td className="px-5 py-4 align-middle"><button type="button" className="w-full min-w-0 text-left" onClick={() => setSelectedRepairId(repair.id)}><div className="truncate text-base font-semibold leading-tight text-white transition-colors hover:text-[#25d3c4]">{repair.title}</div><div className="mt-1 truncate text-sm text-slate-500">{repair.assetName} · {repair.description}</div></button></td>
                    <td className="truncate px-5 py-4 align-middle text-base font-medium text-white">{repair.customerName}</td>
                    <td className="px-5 py-4 align-middle">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setChangingStageRepairId(repair.id);
                        }}
                        className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25d3c4]"
                        aria-label={`Change stage for ${repair.title}`}
                      >
                        <StageBadge stage={repair.stage} />
                      </button>
                    </td>
                    <td className={`relative px-5 py-4 align-middle text-right text-slate-400 ${selectedRepair ? "pr-4" : "pr-2"}`}>
                      <button data-action-menu="true" className="rounded-md p-2 hover:bg-slate-800/70" onClick={(event) => { event.stopPropagation(); setOpenMenuId((prev) => (prev === repair.id ? null : repair.id)); }}><MoreHorizontal className="h-5 w-5" /></button>
                      {openMenuId === repair.id ? (
                        <div data-action-menu="true" className={`absolute top-12 z-10 w-32 rounded-xl border border-[#d7dce3] bg-[#f4f6fa] p-1 text-left shadow-xl ${selectedRepair ? "right-4" : "right-2"}`}>
                          <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-200" onClick={() => { setEditingRepairId(repair.id); setOpenMenuId(null); }}><Pencil className="h-4 w-4" />Edit</button>
                          <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50" onClick={() => { setDeletingRepairId(repair.id); setOpenMenuId(null); }}><Trash2 className="h-4 w-4" />Delete</button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>
        </div>

        {selectedRepair ? (
          <div
            className="relative h-full border-l"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            <RepairDetailsPanel
              repair={selectedRepair}
              itemLabel={repairLabel}
              onClose={() => setSelectedRepairId(null)}
              onLinkChange={() => setOpenRepairLinkMenu((prev) => !prev)}
              onLinkAriaLabel={selectedRepairConversation ? "Change linked conversation" : "Link conversation"}
              isLinkActive={Boolean(selectedRepairConversation)}
              linkedConversationHref={selectedRepairConversation ? `/conversations?threadId=${selectedRepairConversation.id}` : undefined}
              className="h-full pl-6 pr-5 py-5"
            />
            {openRepairLinkMenu ? (
              <div data-repair-link-menu="true" className="absolute bottom-16 right-5 z-20 w-52 rounded-xl border border-[#d7dce3] bg-[#f4f6fa] p-1 text-left shadow-xl">
                {selectedRepairConversation ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
                    onClick={() => selectedRepair ? unlinkConversationFromRepair(selectedRepair.id) : null}
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

      {isAddRepairOpen ? <AddRepairModal mode="create" initialValues={{ ...initialFormValues, repairStage: initialStage }} stageOptions={stageOptions} repairLabel={repairLabel} onClose={() => setIsAddRepairOpen(false)} onSubmit={handleCreateRepair} /> : null}
      {editingRepair ? <AddRepairModal mode="edit" initialValues={toFormValues(editingRepair)} stageOptions={stageOptions} repairLabel={repairLabel} onClose={() => setEditingRepairId(null)} onSubmit={(values) => handleEditRepair(editingRepair.id, values)} /> : null}
      {deletingRepair ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] p-6 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]"><h2 className="text-xl font-semibold">Delete repair</h2><p className="mt-2 text-sm text-slate-600">Are you sure you want to delete <span className="font-semibold">{deletingRepair.title}</span>?</p><div className="mt-6 flex items-center justify-end gap-3"><button type="button" onClick={() => setDeletingRepairId(null)} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button><button type="button" onClick={() => { setRepairs((prev) => prev.filter((repair) => repair.id !== deletingRepair.id)); if (selectedRepairId === deletingRepair.id) setSelectedRepairId(null); setDeletingRepairId(null); }} className="rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600">Delete</button></div></div></div>
      ) : null}
      {isLinkConversationOpen && selectedRepair ? (
        <LinkConversationModal conversations={availableConversations} onClose={() => setIsLinkConversationOpen(false)} onSelect={(threadId) => linkConversationToRepair(threadId, selectedRepair.id)} />
      ) : null}
      {stageChangingRepair ? (
        <ChangeStageModal
          repair={stageChangingRepair}
          stageOptions={stageOptions}
          onClose={() => setChangingStageRepairId(null)}
          onSubmit={(stage) => handleChangeRepairStage(stageChangingRepair.id, stage)}
        />
      ) : null}
    </>
  );
}
