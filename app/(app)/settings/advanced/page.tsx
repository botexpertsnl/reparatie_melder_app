"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Minus, Pencil, Trash2, ChevronUp, ChevronDown, Sparkles, X, MoreHorizontal, Link2 } from "lucide-react";
import clsx from "clsx";
import { readStoredTemplates, type StoredTemplate } from "@/lib/template-store";
import { defaultWorkflowStages, readStoredWorkflowStages, writeStoredWorkflowStages, type StoredTemplateButtonAction, type StoredWorkflowStage } from "@/lib/workflow-stage-store";

type Stage = StoredWorkflowStage;

type StageFormValues = {
  name: string;
  description: string;
  color: string;
  templateAutomationEnabled: boolean;
  templateId: string;
  templateSendDelayEnabled: boolean;
  templateSendDelayHours: number;
  templateSendDelayMinutes: number;
  templateButtonActions: StoredTemplateButtonAction[];
};

type QuickReply = {
  id: string;
  name: string;
  body: string;
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

const quickReplyStorageKey = "statusflow.quick-replies";
const initialQuickReplies: QuickReply[] = [
  { id: "qr_1", name: "Greeting", body: "Thanks for your message! We will check this right away." },
  { id: "qr_2", name: "Pickup Info", body: "Your repair is ready for pickup. Please visit us during opening hours." }
];

function readStoredQuickReplies(fallback: QuickReply[]) {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(quickReplyStorageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as QuickReply[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function syncTemplateButtonActions(
  template: StoredTemplate | undefined,
  currentActions: StoredTemplateButtonAction[]
): StoredTemplateButtonAction[] {
  const buttons = template?.buttons ?? [];
  if (buttons.length === 0) return [];

  return buttons.map((button) => {
    const existing = currentActions.find((action) => action.buttonId === button.id);
    return {
      buttonId: button.id,
      buttonText: button.text?.trim() || "Button",
      sendQuickReplyEnabled: Boolean(existing?.sendQuickReplyEnabled),
      quickReplyId: existing?.quickReplyId ?? "",
      moveToStageEnabled: Boolean(existing?.moveToStageEnabled),
      moveToStageId: existing?.moveToStageId ?? ""
    };
  });
}

function sanitizeTemplateButtonActions(actions: StoredTemplateButtonAction[]) {
  return actions.map((action) => ({
    ...action,
    quickReplyId: action.sendQuickReplyEnabled ? action.quickReplyId ?? "" : "",
    moveToStageId: action.moveToStageEnabled ? action.moveToStageId ?? "" : ""
  }));
}

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
  templateId: "",
  templateSendDelayEnabled: false,
  templateSendDelayHours: 0,
  templateSendDelayMinutes: 0,
  templateButtonActions: []
};

function stageToFormValues(stage: Stage): StageFormValues {
  return {
    name: stage.name,
    description: stage.description,
    color: stage.color,
    templateAutomationEnabled: Boolean(stage.templateAutomationEnabled),
    templateId: stage.templateId ?? "",
    templateSendDelayEnabled: Boolean(stage.templateSendDelayEnabled),
    templateSendDelayHours: Math.max(0, stage.templateSendDelayHours ?? 0),
    templateSendDelayMinutes: Math.min(59, Math.max(0, stage.templateSendDelayMinutes ?? 0)),
    templateButtonActions: stage.templateButtonActions ?? []
  };
}

const placeholderRegex = /{{(\d+)}}/g;

function renderStageTemplatePreviewTokens(template: StoredTemplate) {
  const variableByIndex = new Map(
    (template.variables ?? []).map((variable, index) => {
      const normalizedIndex = typeof variable.index === "number" && Number.isFinite(variable.index) ? Math.max(1, variable.index) : index + 1;
      const label = variable.label?.trim() || variable.name?.trim() || `Variable ${normalizedIndex}`;
      return [normalizedIndex, { label, linked: variable.mode === "repair_field" }] as const;
    })
  );
  const parts: Array<{ type: "text"; value: string } | { type: "token"; index: number; label: string; linked: boolean }> = [];
  let cursor = 0;

  template.body.replace(placeholderRegex, (match, value, offset) => {
    if (offset > cursor) {
      parts.push({ type: "text", value: template.body.slice(cursor, offset) });
    }

    const index = Number(value);
    const variable = variableByIndex.get(index);
    parts.push({
      type: "token",
      index,
      label: variable?.label || `Variable ${index}`,
      linked: Boolean(variable?.linked)
    });

    cursor = offset + match.length;
    return match;
  });

  if (cursor < template.body.length) {
    parts.push({ type: "text", value: template.body.slice(cursor) });
  }

  if (parts.length === 0) {
    return <span className="text-slate-400">Template message preview will appear here.</span>;
  }

  return parts.map((part, index) => {
    if (part.type === "text") {
      return <span key={`text_${index}`}>{part.value}</span>;
    }

    return (
      <span key={`token_${index}`} className="mx-0.5 inline-flex items-center rounded-md border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-700">
        {part.linked ? <Link2 className="mr-1 h-3 w-3" aria-hidden="true" /> : null}
        {part.label}
      </span>
    );
  });
}

function renderStageTemplatePreviewButtons(template: StoredTemplate) {
  if (!template.buttons || template.buttons.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-[#d7dce3] pt-3">
      {template.buttons.map((button) => {
        const normalizedType = button.type.toUpperCase();
        const isQuickReply = normalizedType === "QUICK_REPLY";
        return (
          <span
            key={button.id}
            className={clsx(
              "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
              isQuickReply ? "border-[#b8d8ff] bg-[#eef6ff] text-[#285b9b]" : "border-[#b8e8e2] bg-[#ecfbf8] text-[#16786b]"
            )}
          >
            {button.text.trim() || "Button"}
          </span>
        );
      })}
    </div>
  );
}

function StageModal({
  title,
  confirmLabel,
  initialValues,
  templates,
  quickReplies,
  stageOptions,
  currentStageId,
  onClose,
  onSubmit
}: {
  title: string;
  confirmLabel: string;
  initialValues: StageFormValues;
  templates: StoredTemplate[];
  quickReplies: QuickReply[];
  stageOptions: Stage[];
  currentStageId?: string;
  onClose: () => void;
  onSubmit: (values: StageFormValues) => void;
}) {
  const [values, setValues] = useState<StageFormValues>(initialValues);
  const clampHours = (hours: number) => Math.max(0, hours);
  const clampMinutes = (minutes: number) => Math.min(59, Math.max(0, minutes));
  const setDelayField = (field: "templateSendDelayHours" | "templateSendDelayMinutes", nextValue: number) => {
    setValues((prev) => ({
      ...prev,
      [field]: field === "templateSendDelayHours" ? clampHours(nextValue) : clampMinutes(nextValue)
    }));
  };

  const selectedTemplate = templates.find((template) => template.id === values.templateId);
  const actionableButtons = selectedTemplate?.buttons ?? [];

  useEffect(() => {
    if (!values.templateId) return;
    setValues((prev) => {
      const synced = syncTemplateButtonActions(selectedTemplate, prev.templateButtonActions);
      const changed = JSON.stringify(synced) !== JSON.stringify(prev.templateButtonActions);
      return changed ? { ...prev, templateButtonActions: synced } : prev;
    });
  }, [selectedTemplate, values.templateId]);

  const canSubmit = useMemo(() => {
    if (!values.name.trim() || !values.description.trim()) {
      return false;
    }

    if (values.templateAutomationEnabled && !values.templateId) {
      return false;
    }

    if (values.templateSendDelayHours < 0 || values.templateSendDelayMinutes < 0 || values.templateSendDelayMinutes > 59) {
      return false;
    }

    for (const action of values.templateButtonActions) {
      if (action.sendQuickReplyEnabled && !action.quickReplyId) {
        return false;
      }
      if (action.moveToStageEnabled && !action.moveToStageId) {
        return false;
      }
    }

    return true;
  }, [values]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#02050d]/80 px-4 py-6 backdrop-blur-sm sm:items-center sm:py-8">
      <div className="subtle-scrollbar max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:max-h-[calc(100vh-4rem)]">
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
                    templateId: !prev.templateAutomationEnabled ? prev.templateId : "",
                    templateSendDelayEnabled: !prev.templateAutomationEnabled ? prev.templateSendDelayEnabled : false,
                    templateSendDelayHours: !prev.templateAutomationEnabled ? prev.templateSendDelayHours : 0,
                    templateSendDelayMinutes: !prev.templateAutomationEnabled ? prev.templateSendDelayMinutes : 0,
                    templateButtonActions: !prev.templateAutomationEnabled ? prev.templateButtonActions : []
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
                    onChange={(event) =>
                      setValues((prev) => {
                        const nextTemplateId = event.target.value;
                        const nextTemplate = templates.find((template) => template.id === nextTemplateId);
                        return {
                          ...prev,
                          templateId: nextTemplateId,
                          templateSendDelayEnabled: nextTemplateId ? prev.templateSendDelayEnabled : false,
                          templateSendDelayHours: nextTemplateId ? prev.templateSendDelayHours : 0,
                          templateSendDelayMinutes: nextTemplateId ? prev.templateSendDelayMinutes : 0,
                          templateButtonActions: syncTemplateButtonActions(nextTemplate, prev.templateButtonActions)
                        };
                      })
                    }
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
                  {selectedTemplate ? (
                    <div className="mt-2 rounded-lg border border-[#d7dce3] bg-[#f8fafc] p-3">
                      <div className="text-sm leading-6 text-slate-700">{renderStageTemplatePreviewTokens(selectedTemplate)}</div>
                      {renderStageTemplatePreviewButtons(selectedTemplate)}
                    </div>
                  ) : (
                    <p className="mt-2 min-h-[60px] text-sm text-slate-600">Select a template to preview its message.</p>
                  )}
                </div>

                {values.templateId && actionableButtons.length > 0 ? (
                  <div className="rounded-lg border border-[#d7dce3] bg-[#f7f9fc] p-3">
                    <div className="text-sm font-semibold text-slate-800">Button actions after customer selection</div>
                    <p className="mt-1 text-sm text-slate-500">For each button, choose whether to send a quick reply, move to another stage, or both.</p>
                    <div className="mt-3 space-y-3">
                      {values.templateButtonActions.map((action) => {
                        const nextStageOptions = stageOptions.filter((stage) => stage.id !== currentStageId);
                        const currentQuickReply = quickReplies.find((item) => item.id === action.quickReplyId);
                        const currentTargetStage = stageOptions.find((stage) => stage.id === action.moveToStageId);
                        return (
                          <div key={action.buttonId} className="rounded-lg border border-[#d7dce3] bg-white p-3">
                            <div className="text-sm font-semibold text-slate-800">
                              Button: <span className="text-slate-700">{action.buttonText || "Button"}</span>
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-md border border-[#dfe6f0] bg-[#fafcff] p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium text-slate-700">Send quick reply</span>
                                  <button
                                    type="button"
                                    className={clsx("relative inline-flex h-6 w-11 items-center rounded-full transition", action.sendQuickReplyEnabled ? "bg-[#2fb2a3]" : "bg-slate-300")}
                                    onClick={() =>
                                      setValues((prev) => ({
                                        ...prev,
                                        templateButtonActions: prev.templateButtonActions.map((item) =>
                                          item.buttonId === action.buttonId
                                            ? {
                                                ...item,
                                                sendQuickReplyEnabled: !item.sendQuickReplyEnabled,
                                                quickReplyId: !item.sendQuickReplyEnabled ? item.quickReplyId : ""
                                              }
                                            : item
                                        )
                                      }))
                                    }
                                    aria-label={`Toggle quick reply action for button ${action.buttonText || "Button"}`}
                                  >
                                    <span className={clsx("inline-block h-4 w-4 transform rounded-full bg-white transition", action.sendQuickReplyEnabled ? "translate-x-6" : "translate-x-1")} />
                                  </button>
                                </div>
                                {action.sendQuickReplyEnabled ? (
                                  <div className="mt-2">
                                    <label htmlFor={`button-quick-reply-${action.buttonId}`} className="mb-1 block text-xs font-medium text-slate-600">Quick reply</label>
                                    <select
                                      id={`button-quick-reply-${action.buttonId}`}
                                      className="w-full rounded-lg border border-[#c9d4e3] bg-white px-3 py-2 text-sm outline-none focus:border-[#30b5a5]"
                                      value={action.quickReplyId ?? ""}
                                      onChange={(event) =>
                                        setValues((prev) => ({
                                          ...prev,
                                          templateButtonActions: prev.templateButtonActions.map((item) => (item.buttonId === action.buttonId ? { ...item, quickReplyId: event.target.value } : item))
                                        }))
                                      }
                                    >
                                      <option value="">Select a quick reply</option>
                                      {quickReplies.map((quickReply) => (
                                        <option key={quickReply.id} value={quickReply.id}>
                                          {quickReply.name}
                                        </option>
                                      ))}
                                    </select>
                                    {currentQuickReply ? <p className="mt-1 text-xs text-slate-500">Preview: {currentQuickReply.body}</p> : null}
                                  </div>
                                ) : null}
                              </div>

                              <div className="rounded-md border border-[#dfe6f0] bg-[#fafcff] p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium text-slate-700">Move to stage</span>
                                  <button
                                    type="button"
                                    className={clsx("relative inline-flex h-6 w-11 items-center rounded-full transition", action.moveToStageEnabled ? "bg-[#2fb2a3]" : "bg-slate-300")}
                                    onClick={() =>
                                      setValues((prev) => ({
                                        ...prev,
                                        templateButtonActions: prev.templateButtonActions.map((item) =>
                                          item.buttonId === action.buttonId
                                            ? {
                                                ...item,
                                                moveToStageEnabled: !item.moveToStageEnabled,
                                                moveToStageId: !item.moveToStageEnabled ? item.moveToStageId : ""
                                              }
                                            : item
                                        )
                                      }))
                                    }
                                    aria-label={`Toggle move stage action for button ${action.buttonText || "Button"}`}
                                  >
                                    <span className={clsx("inline-block h-4 w-4 transform rounded-full bg-white transition", action.moveToStageEnabled ? "translate-x-6" : "translate-x-1")} />
                                  </button>
                                </div>
                                {action.moveToStageEnabled ? (
                                  <div className="mt-2">
                                    <label htmlFor={`button-stage-${action.buttonId}`} className="mb-1 block text-xs font-medium text-slate-600">Target stage</label>
                                    <select
                                      id={`button-stage-${action.buttonId}`}
                                      className="w-full rounded-lg border border-[#c9d4e3] bg-white px-3 py-2 text-sm outline-none focus:border-[#30b5a5]"
                                      value={action.moveToStageId ?? ""}
                                      onChange={(event) =>
                                        setValues((prev) => ({
                                          ...prev,
                                          templateButtonActions: prev.templateButtonActions.map((item) => (item.buttonId === action.buttonId ? { ...item, moveToStageId: event.target.value } : item))
                                        }))
                                      }
                                    >
                                      <option value="">Select a target stage</option>
                                      {nextStageOptions.map((stage) => (
                                        <option key={stage.id} value={stage.id}>
                                          {stage.name}
                                        </option>
                                      ))}
                                    </select>
                                    {currentTargetStage ? <p className="mt-1 text-xs text-slate-500">Selected: {currentTargetStage.name}</p> : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {values.templateId ? (
                  <div className="rounded-lg border border-[#d7dce3] bg-[#f7f9fc] p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">Moment of sending</div>
                        <div className="mt-1 text-sm text-slate-500">
                          The template message will be triggered immediately by default after the repair is moved to this stage.
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
                          <span className={clsx("rounded-full px-2.5 py-1", values.templateSendDelayEnabled ? "bg-slate-200 text-slate-700" : "bg-[#d3f3ef] text-[#0d7f73]")}>Default: Directly</span>
                          <span className={clsx("rounded-full px-2.5 py-1", values.templateSendDelayEnabled ? "bg-[#d3f3ef] text-[#0d7f73]" : "bg-slate-200 text-slate-700")}>Left = Custom time</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={clsx("relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition", values.templateSendDelayEnabled ? "bg-slate-300" : "bg-[#2fb2a3]")}
                        onClick={() =>
                          setValues((prev) => ({
                            ...prev,
                            templateSendDelayEnabled: !prev.templateSendDelayEnabled
                          }))
                        }
                        aria-label="Toggle sending mode (right: directly, left: custom time)"
                      >
                        <span className={clsx("inline-block h-5 w-5 transform rounded-full bg-white transition", values.templateSendDelayEnabled ? "translate-x-1" : "translate-x-6")} />
                      </button>
                    </div>

                    <div className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">{values.templateSendDelayEnabled ? "Custom delay" : "Directly"}</div>
                    <p className="mt-1 text-sm text-slate-600">
                      {values.templateSendDelayEnabled
                        ? `Template message will be triggered ${values.templateSendDelayHours} hour(s) and ${values.templateSendDelayMinutes} minute(s) after the repair is set to this stage.`
                        : "Template message will be triggered directly after the repair is set to this stage."}
                    </p>

                    {values.templateSendDelayEnabled ? (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="template-delay-hours" className="mb-2 block text-sm font-medium text-slate-700">Delay in hours</label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-[#bfc9d8] bg-white p-2 text-slate-600 hover:bg-slate-100"
                              aria-label="Decrease delay hours"
                              onClick={() => setDelayField("templateSendDelayHours", values.templateSendDelayHours - 1)}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <input
                              id="template-delay-hours"
                              type="number"
                              min={0}
                              className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
                              value={values.templateSendDelayHours}
                              onChange={(event) => setDelayField("templateSendDelayHours", Number(event.target.value) || 0)}
                            />
                            <button
                              type="button"
                              className="rounded-lg border border-[#bfc9d8] bg-white p-2 text-slate-600 hover:bg-slate-100"
                              aria-label="Increase delay hours"
                              onClick={() => setDelayField("templateSendDelayHours", values.templateSendDelayHours + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label htmlFor="template-delay-minutes" className="mb-2 block text-sm font-medium text-slate-700">Delay in minutes</label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-[#bfc9d8] bg-white p-2 text-slate-600 hover:bg-slate-100"
                              aria-label="Decrease delay minutes"
                              onClick={() => setDelayField("templateSendDelayMinutes", values.templateSendDelayMinutes - 1)}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <input
                              id="template-delay-minutes"
                              type="number"
                              min={0}
                              max={59}
                              className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
                              value={values.templateSendDelayMinutes}
                              onChange={(event) => setDelayField("templateSendDelayMinutes", Number(event.target.value) || 0)}
                            />
                            <button
                              type="button"
                              className="rounded-lg border border-[#bfc9d8] bg-white p-2 text-slate-600 hover:bg-slate-100"
                              aria-label="Increase delay minutes"
                              onClick={() => setDelayField("templateSendDelayMinutes", values.templateSendDelayMinutes + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
  const [quickReplyOptions, setQuickReplyOptions] = useState<QuickReply[]>(() => readStoredQuickReplies(initialQuickReplies));
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [deletingStageId, setDeletingStageId] = useState<string | null>(null);
  const [openStageMenuId, setOpenStageMenuId] = useState<string | null>(null);

  useEffect(() => {
    const refreshTemplates = () => {
      setTemplateOptions(readStoredTemplates(defaultTemplates).filter((template) => template.active));
      setQuickReplyOptions(readStoredQuickReplies(initialQuickReplies));
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
      templateId: values.templateAutomationEnabled ? values.templateId : undefined,
      templateSendDelayEnabled: values.templateAutomationEnabled ? values.templateSendDelayEnabled : false,
      templateSendDelayHours: values.templateAutomationEnabled && values.templateSendDelayEnabled ? values.templateSendDelayHours : 0,
      templateSendDelayMinutes: values.templateAutomationEnabled && values.templateSendDelayEnabled ? values.templateSendDelayMinutes : 0,
      templateButtonActions: values.templateAutomationEnabled ? sanitizeTemplateButtonActions(values.templateButtonActions) : []
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
          templateId: values.templateAutomationEnabled ? values.templateId : undefined,
          templateSendDelayEnabled: values.templateAutomationEnabled ? values.templateSendDelayEnabled : false,
          templateSendDelayHours: values.templateAutomationEnabled && values.templateSendDelayEnabled ? values.templateSendDelayHours : 0,
          templateSendDelayMinutes: values.templateAutomationEnabled && values.templateSendDelayEnabled ? values.templateSendDelayMinutes : 0,
          templateButtonActions: values.templateAutomationEnabled ? sanitizeTemplateButtonActions(values.templateButtonActions) : []
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
    const delayLabel = stage.templateSendDelayEnabled
      ? `${stage.templateSendDelayHours ?? 0}h ${stage.templateSendDelayMinutes ?? 0}m after assignment`
      : "Directly";
    const enabledButtonActionCount = (stage.templateButtonActions ?? []).filter((action) => action.sendQuickReplyEnabled || action.moveToStageEnabled).length;

    return (
      <div
        key={stage.id}
        role="button"
        tabIndex={0}
        onClick={() => setEditingStageId(stage.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setEditingStageId(stage.id);
          }
        }}
        className="flex cursor-pointer items-center justify-between gap-4 border-b border-[#253149] px-4 py-4 transition-colors hover:bg-[#1a2538] last:border-b-0"
      >
        <div className="flex items-start gap-4">
          <div className="mt-0.5 flex min-h-9 w-5 shrink-0 flex-col items-center text-slate-500">
            {canMoveUp ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  moveStage(index, "up");
                }}
                className="p-0.5 hover:text-slate-300"
                aria-label={`Move ${stage.name} up`}
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            ) : (
              <span className="h-5 w-5" aria-hidden="true" />
            )}
            {canMoveDown ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  moveStage(index, "down");
                }}
                className="p-0.5 hover:text-slate-300"
                aria-label={`Move ${stage.name} down`}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            ) : (
              <span className="h-5 w-5" aria-hidden="true" />
            )}
          </div>

          <span className="mt-2 h-3.5 w-3.5 rounded-full" style={{ backgroundColor: stage.color }} />

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-left text-lg font-semibold text-white transition-colors hover:text-cyan-300">{stage.name}</span>
              {stage.isStart ? <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">Start</span> : null}
              {stage.isTerminal ? <span className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-300">End</span> : null}
              {stage.requiresApproval ? <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300"><Sparkles className="h-3 w-3" />Approval</span> : null}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
              <span>{stage.description}</span>
              {stage.templateAutomationEnabled && stage.templateId ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">
                  Template: {templateNameById(stage.templateId) ?? "Deleted template"} · {delayLabel}
                  {enabledButtonActionCount > 0 ? ` · ${enabledButtonActionCount} button action(s)` : ""}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {!isFixedStage ? (
          <div className="relative flex items-center pr-2">
            <button
              type="button"
              data-action-menu="true"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-800/70"
              aria-label={`Open actions for ${stage.name}`}
              onClick={(event) => {
                event.stopPropagation();
                setOpenStageMenuId((prev) => (prev === stage.id ? null : stage.id));
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {openStageMenuId === stage.id ? (
              <div data-action-menu="true" className="absolute right-0 top-9 z-10 w-32 rounded-xl border border-[#d7dce3] bg-[#f4f6fa] p-1 shadow-xl">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-200"
                  onClick={(event) => {
                    event.stopPropagation();
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
                  onClick={(event) => {
                    event.stopPropagation();
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
        ) : null}
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
          <section className="mb-3 overflow-visible rounded-2xl border border-[#253149] bg-[#121b2b]/65">
            {renderStageRow(startStage)}
          </section>
        ) : null}

        {middleStages.length > 0 ? (
          <section className="overflow-visible rounded-2xl border border-[#253149] bg-[#121b2b]/65">
            {middleStages.map(renderStageRow)}
          </section>
        ) : null}

        {finalStages.length > 0 ? (
          <section className="mb-8 mt-3 overflow-visible rounded-2xl border border-[#253149] bg-[#121b2b]/65">
            {finalStages.map(renderStageRow)}
          </section>
        ) : null}
      </div>

      {isAddModalOpen ? (
        <StageModal
          title="Add Stage"
          confirmLabel="Create"
          initialValues={emptyFormValues}
          templates={templateOptions}
          quickReplies={quickReplyOptions}
          stageOptions={stages}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleAddStage}
        />
      ) : null}

      {editingStage ? (
        <StageModal
          title={`Edit Stage: ${editingStage.name}`}
          confirmLabel="Save"
          initialValues={stageToFormValues(editingStage)}
          templates={templateOptions}
          quickReplies={quickReplyOptions}
          stageOptions={stages}
          currentStageId={editingStage.id}
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
