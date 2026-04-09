"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Sparkles, X, MoreHorizontal } from "lucide-react";
import clsx from "clsx";
import { readStoredTemplates, type StoredTemplate } from "@/lib/template-store";
import { defaultWorkflowStages, readStoredWorkflowStages, writeStoredWorkflowStages, type StoredWorkflowStage } from "@/lib/workflow-stage-store";

type Stage = StoredWorkflowStage;

type StageFormValues = {
  name: string;
  description: string;
  color: string;
  templateAutomationEnabled: boolean;
  templateId: string;
};

const colorOptions = ["#76d2b0", "#4e8de8", "#ecbd69", "#e88e8e", "#b18be6", "#7ec5d4", "#efb37e", "#e59fcd", "#e48998", "#9a9de7", "#74c8bf", "#9ca3af"];

const START_STAGE_KEY = "new";
const FINAL_STAGE_KEYS = ["completed", "cancelled"] as const;
const FINAL_STAGE_KEY_SET = new Set<string>(FINAL_STAGE_KEYS);

const fixedStagePresets: Record<string, Stage> = {
  new: {
    id: "stage_new",
    name: "New",
    key: "new",
    description: "Repair just received",
    color: "#6b7280",
    visibleToCustomer: true,
    isStart: true
  },
  completed: {
    id: "stage_completed",
    name: "Completed",
    key: "completed",
    description: "Repair completed",
    color: "#10b981",
    visibleToCustomer: true,
    isTerminal: true
  },
  cancelled: {
    id: "stage_cancelled",
    name: "Cancelled",
    key: "cancelled",
    description: "Repair cancelled",
    color: "#ef4444",
    visibleToCustomer: true,
    isTerminal: true
  }
};

const defaultTemplates: StoredTemplate[] = [
  {
    id: "tpl_1",
    name: "Device Received",
    category: "Update",
    language: "nl",
    body: "Hallo {{1}}, we hebben uw {{2}} ontvangen en gaan deze diagnosticeren. U ontvangt een update binnen 24 uur.",
    spotlerId: "",
    active: true
  },
  {
    id: "tpl_2",
    name: "Device Ready",
    category: "Pickup",
    language: "nl",
    body: "Hallo {{1}}, uw {{2}} is gerepareerd en klaar voor ophalen! Kom langs op ons adres tijdens openingstijden.",
    spotlerId: "",
    active: true
  }
];

function normalizeStages(stages: Stage[]): Stage[] {
  const withoutWaitingParts = stages.filter((stage) => stage.key !== "waiting_parts");
  const hasNotApproved = withoutWaitingParts.some((stage) => stage.key === "not_approved");
  const hasApproved = withoutWaitingParts.some((stage) => stage.key === "approved");
  const approvalIndex = withoutWaitingParts.findIndex((stage) => stage.key === "awaiting_approval");

  const withSubStages = [...withoutWaitingParts];
  if (approvalIndex >= 0) {
    if (!hasNotApproved) {
      withSubStages.splice(approvalIndex + 1, 0, {
        id: `stage_not_approved_${Date.now()}`,
        name: "Not Approved",
        key: "not_approved",
        description: "Customer did not approve the requested work",
        color: "#ef4444",
        visibleToCustomer: true
      });
    }

    const approvedInsertIndex = withSubStages.findIndex((stage) => stage.key === "not_approved") + 1;
    if (!hasApproved) {
      withSubStages.splice(approvedInsertIndex, 0, {
        id: `stage_approved_${Date.now()}`,
        name: "Approved",
        key: "approved",
        description: "Customer approved and work can continue",
        color: "#22c55e",
        visibleToCustomer: true
      });
    }
  }

  const withRequiredStages = [...withSubStages];
  const ensureStage = (key: keyof typeof fixedStagePresets) => {
    const existingIndex = withRequiredStages.findIndex((stage) => stage.key === key);
    if (existingIndex >= 0) {
      withRequiredStages[existingIndex] = { ...withRequiredStages[existingIndex] };
      return;
    }

    withRequiredStages.push({ ...fixedStagePresets[key] });
  };

  ensureStage("new");
  ensureStage("completed");
  ensureStage("cancelled");

  const startStage = withRequiredStages.find((stage) => stage.key === START_STAGE_KEY) ?? { ...fixedStagePresets.new };
  const finalStages = FINAL_STAGE_KEYS.map((key) => withRequiredStages.find((stage) => stage.key === key) ?? { ...fixedStagePresets[key] });
  const middleStages = withRequiredStages.filter((stage) => stage.key !== START_STAGE_KEY && !FINAL_STAGE_KEY_SET.has(stage.key));

  return [
    { ...startStage, isStart: true, isTerminal: false },
    ...middleStages.map((stage) => ({ ...stage, isStart: false })),
    ...finalStages.map((stage) => ({ ...stage, isStart: false, isTerminal: true }))
  ];
}


const emptyFormValues: StageFormValues = {
  name: "",
  description: "",
  color: "#4e8de8",
  templateAutomationEnabled: false,
  templateId: ""
};

function stageToFormValues(stage: Stage): StageFormValues {
  return {
    name: stage.name,
    description: stage.description,
    color: stage.color,
    templateAutomationEnabled: Boolean(stage.templateAutomationEnabled),
    templateId: stage.templateId ?? ""
  };
}

function StageModal({
  title,
  confirmLabel,
  initialValues,
  templates,
  onClose,
  onSubmit
}: {
  title: string;
  confirmLabel: string;
  initialValues: StageFormValues;
  templates: StoredTemplate[];
  onClose: () => void;
  onSubmit: (values: StageFormValues) => void;
}) {
  const [values, setValues] = useState<StageFormValues>(initialValues);

  const selectedTemplate = templates.find((template) => template.id === values.templateId);

  const canSubmit = useMemo(() => {
    if (!values.name.trim() || !values.description.trim()) {
      return false;
    }

    if (values.templateAutomationEnabled && !values.templateId) {
      return false;
    }

    return true;
  }, [values]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="text-2xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-200" aria-label="Close stage dialog">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-5 px-6 pb-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) return;
            onSubmit(values);
          }}
        >
          <div>
            <label htmlFor="stage-name" className="mb-2 block text-sm font-medium text-slate-700">Name *</label>
            <input
              id="stage-name"
              className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
              placeholder="e.g. Waiting for Customer"
              value={values.name}
              onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="stage-description" className="mb-2 block text-sm font-medium text-slate-700">Description *</label>
            <textarea
              id="stage-description"
              className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
              placeholder="What does this stage represent?"
              value={values.description}
              onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Color</label>
            <div className="flex flex-wrap gap-3">
              {colorOptions.map((color) => {
                const selected = values.color === color;

                return (
                  <button
                    key={color}
                    type="button"
                    className={clsx("h-8 w-8 rounded-full border-2 transition", selected ? "border-slate-900 ring-2 ring-slate-300" : "border-transparent hover:border-slate-400")}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                    onClick={() => setValues((prev) => ({ ...prev, color }))}
                  />
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[#d7dce3] bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-800">Automatic template message</div>
                <div className="mt-1 text-sm text-slate-500">Send a predefined WhatsApp template when this stage is set.</div>
              </div>
              <button
                type="button"
                className={clsx("relative inline-flex h-7 w-12 items-center rounded-full transition", values.templateAutomationEnabled ? "bg-[#2fb2a3]" : "bg-slate-300")}
                onClick={() =>
                  setValues((prev) => ({
                    ...prev,
                    templateAutomationEnabled: !prev.templateAutomationEnabled,
                    templateId: !prev.templateAutomationEnabled ? prev.templateId : ""
                  }))
                }
                aria-label="Toggle automatic template message"
              >
                <span className={clsx("inline-block h-5 w-5 transform rounded-full bg-white transition", values.templateAutomationEnabled ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>

            {values.templateAutomationEnabled ? (
              <div className="mt-4 space-y-3 border-t border-[#e5e9ef] pt-4">
                <div>
                  <label htmlFor="template-message" className="mb-2 block text-sm font-medium text-slate-700">Template message</label>
                  <select
                    id="template-message"
                    className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
                    value={values.templateId}
                    onChange={(event) => setValues((prev) => ({ ...prev, templateId: event.target.value }))}
                  >
                    <option value="">Select a template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg border border-[#d7dce3] bg-[#f7f9fc] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Template preview</div>
                  <p className="mt-2 line-clamp-3 min-h-[60px] text-sm text-slate-600">{selectedTemplate ? selectedTemplate.body : "Select a template to preview its message."}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
            <button
              type="submit"
              className={clsx("rounded-xl px-5 py-2 text-sm font-semibold text-white", canSubmit ? "bg-[#2fb2a3] hover:bg-[#2a9f91]" : "cursor-not-allowed bg-slate-400")}
              disabled={!canSubmit}
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteStageModal({ stageName, onCancel, onConfirm }: { stageName: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] p-6 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <h2 className="text-xl font-semibold">Delete stage</h2>
        <p className="mt-2 text-sm text-slate-600">Are you sure you want to delete <span className="font-semibold">{stageName}</span>? This action cannot be undone.</p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">No</button>
          <button type="button" onClick={onConfirm} className="rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600">Yes, delete</button>
        </div>
      </div>
    </div>
  );
}

export default function AdvancedSettingsPage() {
  const [stages, setStages] = useState<Stage[]>(() => normalizeStages(readStoredWorkflowStages(defaultWorkflowStages)));
  const [templateOptions, setTemplateOptions] = useState<StoredTemplate[]>(() => readStoredTemplates(defaultTemplates).filter((template) => template.active));
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [deletingStageId, setDeletingStageId] = useState<string | null>(null);
  const [openStageMenuId, setOpenStageMenuId] = useState<string | null>(null);

  useEffect(() => {
    const refreshTemplates = () => {
      setTemplateOptions(readStoredTemplates(defaultTemplates).filter((template) => template.active));
    };

    refreshTemplates();
    window.addEventListener("templates:changed", refreshTemplates);
    window.addEventListener("storage", refreshTemplates);

    return () => {
      window.removeEventListener("templates:changed", refreshTemplates);
      window.removeEventListener("storage", refreshTemplates);
    };
  }, []);

  useEffect(() => {
    writeStoredWorkflowStages(stages);
  }, [stages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-action-menu='true']")) return;
      setOpenStageMenuId(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const editingStage = stages.find((stage) => stage.id === editingStageId) ?? null;
  const deletingStage = stages.find((stage) => stage.id === deletingStageId) ?? null;
  const startStage = stages.find((stage) => stage.key === START_STAGE_KEY) ?? null;
  const finalStages = stages.filter((stage) => FINAL_STAGE_KEY_SET.has(stage.key));
  const middleStages = stages.filter((stage) => stage.key !== START_STAGE_KEY && !FINAL_STAGE_KEY_SET.has(stage.key));

  const templateNameById = (templateId?: string) => templateOptions.find((template) => template.id === templateId)?.name;

  const moveStage = (index: number, direction: "up" | "down") => {
    const stage = stages[index];
    if (!stage || stage.key === START_STAGE_KEY || FINAL_STAGE_KEY_SET.has(stage.key)) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const targetStage = stages[targetIndex];
    if (!targetStage || targetStage.key === START_STAGE_KEY || FINAL_STAGE_KEY_SET.has(targetStage.key)) return;

    setStages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return normalizeStages(next);
    });
  };

  const handleAddStage = (values: StageFormValues) => {
    const newStage: Stage = {
      id: `stage_${Date.now()}`,
      name: values.name.trim(),
      key: values.name.trim().toLowerCase().replace(/\s+/g, "_"),
      description: values.description.trim(),
      color: values.color,
      visibleToCustomer: true,
      templateAutomationEnabled: values.templateAutomationEnabled,
      templateId: values.templateAutomationEnabled ? values.templateId : undefined
    };

    setStages((prev) => normalizeStages([...prev, newStage]));
    setIsAddModalOpen(false);
  };

  const handleEditStage = (stageId: string, values: StageFormValues) => {
    setStages((prev) =>
      normalizeStages(prev.map((stage) => {
        if (stage.id !== stageId) return stage;

        const nextKey = stage.key === START_STAGE_KEY || FINAL_STAGE_KEY_SET.has(stage.key)
          ? stage.key
          : values.name.trim().toLowerCase().replace(/\s+/g, "_");

        return {
          ...stage,
          name: values.name.trim(),
          key: nextKey,
          description: values.description.trim(),
          color: values.color,
          templateAutomationEnabled: values.templateAutomationEnabled,
          templateId: values.templateAutomationEnabled ? values.templateId : undefined
        };
      }))
    );

    setEditingStageId(null);
  };

  const handleDeleteStage = (stageId: string) => {
    setStages((prev) => normalizeStages(prev.filter((stage) => stage.id !== stageId)));
    setDeletingStageId(null);
  };

  const renderStageRow = (stage: Stage) => {
    const index = stages.findIndex((candidate) => candidate.id === stage.id);
    const isFixedStage = stage.key === START_STAGE_KEY || FINAL_STAGE_KEY_SET.has(stage.key);
    const previousStage = index > 0 ? stages[index - 1] : null;
    const nextStage = index < stages.length - 1 ? stages[index + 1] : null;
    const canMoveUp = Boolean(
      !isFixedStage &&
      previousStage &&
      previousStage.key !== START_STAGE_KEY &&
      !FINAL_STAGE_KEY_SET.has(previousStage.key)
    );
    const canMoveDown = Boolean(
      !isFixedStage &&
      nextStage &&
      nextStage.key !== START_STAGE_KEY &&
      !FINAL_STAGE_KEY_SET.has(nextStage.key)
    );

    return (
      <div key={stage.id} className="flex items-center justify-between gap-4 border-b border-[#253149] px-4 py-4 last:border-b-0">
        <div className="flex items-start gap-4">
          <div className="mt-0.5 flex min-h-9 w-5 shrink-0 flex-col items-center text-slate-500">
            {canMoveUp ? (
              <button type="button" onClick={() => moveStage(index, "up")} className="p-0.5 hover:text-slate-300" aria-label={`Move ${stage.name} up`}>
                <ChevronUp className="h-4 w-4" />
              </button>
            ) : (
              <span className="h-5 w-5" aria-hidden="true" />
            )}
            {canMoveDown ? (
              <button type="button" onClick={() => moveStage(index, "down")} className="p-0.5 hover:text-slate-300" aria-label={`Move ${stage.name} down`}>
                <ChevronDown className="h-4 w-4" />
              </button>
            ) : (
              <span className="h-5 w-5" aria-hidden="true" />
            )}
          </div>

          <span className="mt-2 h-3.5 w-3.5 rounded-full" style={{ backgroundColor: stage.color }} />

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingStageId(stage.id)}
                className="text-left text-lg font-semibold text-white underline-offset-4 hover:text-cyan-300 hover:underline"
              >
                {stage.name}
              </button>
              {stage.isStart ? <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">Start</span> : null}
              {stage.isTerminal ? <span className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-300">Terminal</span> : null}
              {stage.requiresApproval ? <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300"><Sparkles className="h-3 w-3" />Approval</span> : null}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
              <span>{stage.description}</span>
              {stage.templateAutomationEnabled && stage.templateId ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">
                  Template: {templateNameById(stage.templateId) ?? "Deleted template"}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative flex items-center pr-2">
          <button
            type="button"
            data-action-menu="true"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800/70"
            aria-label={`Open actions for ${stage.name}`}
            onClick={() => setOpenStageMenuId((prev) => (prev === stage.id ? null : stage.id))}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {openStageMenuId === stage.id ? (
            <div data-action-menu="true" className="absolute right-0 top-9 z-10 w-32 rounded-xl border border-[#d7dce3] bg-[#f4f6fa] p-1 shadow-xl">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-200"
                onClick={() => {
                  setEditingStageId(stage.id);
                  setOpenStageMenuId(null);
                }}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50"
                onClick={() => {
                  setDeletingStageId(stage.id);
                  setOpenStageMenuId(null);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Workflow Stages</h1>
            <p className="mt-1 text-sm text-slate-400">Configure stages for your repairs</p>
          </div>
          <button onClick={() => setIsAddModalOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--surface-3)] px-5 text-sm font-semibold text-[var(--text-primary)]">
            <Plus className="h-4 w-4" />
            Add Stage
          </button>
        </div>

        {startStage ? (
          <section className="mb-3 overflow-hidden rounded-2xl border border-[#253149] bg-[#121b2b]/65">
            {renderStageRow(startStage)}
          </section>
        ) : null}

        {middleStages.length > 0 ? (
          <section className="overflow-hidden rounded-2xl border border-[#253149] bg-[#121b2b]/65">
            {middleStages.map(renderStageRow)}
          </section>
        ) : null}

        {finalStages.length > 0 ? (
          <section className="mt-3 overflow-hidden rounded-2xl border border-[#253149] bg-[#121b2b]/65">
            {finalStages.map(renderStageRow)}
          </section>
        ) : null}
      </div>

      {isAddModalOpen ? (
        <StageModal title="Add Stage" confirmLabel="Create" initialValues={emptyFormValues} templates={templateOptions} onClose={() => setIsAddModalOpen(false)} onSubmit={handleAddStage} />
      ) : null}

      {editingStage ? (
        <StageModal
          title={`Edit Stage: ${editingStage.name}`}
          confirmLabel="Save"
          initialValues={stageToFormValues(editingStage)}
          templates={templateOptions}
          onClose={() => setEditingStageId(null)}
          onSubmit={(values) => handleEditStage(editingStage.id, values)}
        />
      ) : null}

      {deletingStage ? (
        <DeleteStageModal stageName={deletingStage.name} onCancel={() => setDeletingStageId(null)} onConfirm={() => handleDeleteStage(deletingStage.id)} />
      ) : null}
    </>
  );
}
