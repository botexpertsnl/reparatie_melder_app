"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Eye,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  X
} from "lucide-react";
import clsx from "clsx";

type Stage = {
  id: string;
  name: string;
  key: string;
  description: string;
  color: string;
  visibleToCustomer: boolean;
  isStart?: boolean;
  isTerminal?: boolean;
  requiresApproval?: boolean;
  templateAutomationEnabled?: boolean;
  templateMessage?: string;
};

type StageFormValues = {
  name: string;
  description: string;
  color: string;
  templateAutomationEnabled: boolean;
  templateMessage: string;
};

const colorOptions = [
  "#76d2b0",
  "#4e8de8",
  "#ecbd69",
  "#e88e8e",
  "#b18be6",
  "#7ec5d4",
  "#efb37e",
  "#e59fcd",
  "#e48998",
  "#9a9de7",
  "#74c8bf",
  "#9ca3af"
];

const templateOptions = [
  "repair_update_basic",
  "approval_request_extended_work",
  "ready_for_pickup_notification",
  "repair_completed_confirmation"
];

const initialStages: Stage[] = [
  {
    id: "stage_new",
    name: "New",
    key: "new",
    description: "Repair just received",
    color: "#6b7280",
    visibleToCustomer: true,
    isStart: true
  },
  {
    id: "stage_scheduled",
    name: "Scheduled",
    key: "scheduled",
    description: "Repair is scheduled",
    color: "#4e8de8",
    visibleToCustomer: true
  },
  {
    id: "stage_progress",
    name: "In Progress",
    key: "in_progress",
    description: "Being worked on",
    color: "#ecbd69",
    visibleToCustomer: true
  },
  {
    id: "stage_approval",
    name: "Awaiting Approval",
    key: "awaiting_approval",
    description: "Customer approval needed for additional work",
    color: "#fb923c",
    visibleToCustomer: true,
    requiresApproval: true
  },
  {
    id: "stage_parts",
    name: "Waiting for Parts",
    key: "waiting_parts",
    description: "Waiting on parts delivery",
    color: "#a855f7",
    visibleToCustomer: true
  },
  {
    id: "stage_pickup",
    name: "Ready for Pickup",
    key: "ready_pickup",
    description: "Car is ready to be collected",
    color: "#22c1dc",
    visibleToCustomer: true
  },
  {
    id: "stage_completed",
    name: "Completed",
    key: "completed",
    description: "Repair completed",
    color: "#10b981",
    visibleToCustomer: true,
    isTerminal: true
  }
];

const initialFormValues: StageFormValues = {
  name: "",
  description: "",
  color: "#4e8de8",
  templateAutomationEnabled: false,
  templateMessage: ""
};

function AddStageModal({ onClose, onCreate }: { onClose: () => void; onCreate: (values: StageFormValues) => void }) {
  const [values, setValues] = useState<StageFormValues>(initialFormValues);

  const canCreate = useMemo(() => {
    if (!values.name.trim() || !values.description.trim()) {
      return false;
    }

    if (values.templateAutomationEnabled && !values.templateMessage) {
      return false;
    }

    return true;
  }, [values]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="text-3xl font-semibold">Add Stage</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-200" aria-label="Close add stage dialog">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-5 px-6 pb-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canCreate) return;
            onCreate(values);
          }}
        >
          <div>
            <label htmlFor="stage-name" className="mb-2 block text-sm font-medium text-slate-700">
              Name *
            </label>
            <input
              id="stage-name"
              className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
              placeholder="e.g. Waiting for Customer"
              value={values.name}
              onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="stage-description" className="mb-2 block text-sm font-medium text-slate-700">
              Description *
            </label>
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
                    className={clsx(
                      "h-8 w-8 rounded-full border-2 transition",
                      selected ? "border-slate-900 ring-2 ring-slate-300" : "border-transparent hover:border-slate-400"
                    )}
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
                className={clsx(
                  "relative inline-flex h-7 w-12 items-center rounded-full transition",
                  values.templateAutomationEnabled ? "bg-[#2fb2a3]" : "bg-slate-300"
                )}
                onClick={() =>
                  setValues((prev) => ({
                    ...prev,
                    templateAutomationEnabled: !prev.templateAutomationEnabled,
                    templateMessage: !prev.templateAutomationEnabled ? prev.templateMessage : ""
                  }))
                }
                aria-label="Toggle automatic template message"
              >
                <span
                  className={clsx(
                    "inline-block h-5 w-5 transform rounded-full bg-white transition",
                    values.templateAutomationEnabled ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            {values.templateAutomationEnabled ? (
              <div className="mt-4 border-t border-[#e5e9ef] pt-4">
                <label htmlFor="template-message" className="mb-2 block text-sm font-medium text-slate-700">
                  Template message
                </label>
                <select
                  id="template-message"
                  className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
                  value={values.templateMessage}
                  onChange={(event) => setValues((prev) => ({ ...prev, templateMessage: event.target.value }))}
                >
                  <option value="">Select a template</option>
                  {templateOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="submit"
              className={clsx(
                "rounded-xl px-5 py-2 text-sm font-semibold text-white",
                canCreate ? "bg-[#2fb2a3] hover:bg-[#2a9f91]" : "cursor-not-allowed bg-slate-400"
              )}
              disabled={!canCreate}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdvancedSettingsPage() {
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const moveStage = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    setStages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
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
      templateMessage: values.templateAutomationEnabled ? values.templateMessage : undefined
    };

    setStages((prev) => [...prev, newStage]);
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold text-white">Workflow Stages</h1>
            <p className="mt-2 text-slate-400">Configure stages for your repairs</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#28d9c6] px-5 py-2.5 text-sm font-semibold text-[#022a36]"
          >
            <Plus className="h-4 w-4" />
            Add Stage
          </button>
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#253149] bg-[#121b2b]/65">
          {stages.map((stage, index) => (
            <div key={stage.id} className="flex items-center justify-between gap-4 border-b border-[#253149] px-4 py-4 last:border-b-0">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex flex-col items-center text-slate-500">
                  <button type="button" onClick={() => moveStage(index, "up")} className="p-0.5 hover:text-slate-300" aria-label={`Move ${stage.name} up`}>
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => moveStage(index, "down")} className="p-0.5 hover:text-slate-300" aria-label={`Move ${stage.name} down`}>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                <span className="mt-2 h-3.5 w-3.5 rounded-full" style={{ backgroundColor: stage.color }} />

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-3xl font-semibold text-white">{stage.name}</div>
                    <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-xs text-slate-400">{stage.key}</span>
                    {stage.isStart ? <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">Start</span> : null}
                    {stage.isTerminal ? <span className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-300">Terminal</span> : null}
                    {stage.requiresApproval ? <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300"><Sparkles className="h-3 w-3" />Approval</span> : null}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      {stage.visibleToCustomer ? "Visible to customer" : "Internal only"}
                    </span>
                    <span>{stage.description}</span>
                    {stage.templateAutomationEnabled && stage.templateMessage ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">
                        Template: {stage.templateMessage}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pr-2">
                <button type="button" className="text-slate-300 hover:text-white" aria-label={`Edit ${stage.name}`}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" className="text-red-400 hover:text-red-300" aria-label={`Delete ${stage.name}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>

      {isModalOpen ? <AddStageModal onClose={() => setIsModalOpen(false)} onCreate={handleAddStage} /> : null}
    </>
  );
}
