"use client";

import { useEffect, useMemo, useState } from "react";
import { Link as LinkIcon, MessageSquare, Wrench, X } from "lucide-react";
import type { StoredRepair } from "@/lib/repair-store";
import { defaultWorkflowStages, filterVisibleWorkflowStages, readStoredWorkflowStages, type StoredWorkflowStage } from "@/lib/workflow-stage-store";
import { defaultStoredTemplates, readStoredTemplates, type StoredTemplate } from "@/lib/template-store";

type RepairDetailsPanelProps = {
  repair: StoredRepair;
  itemLabel?: string;
  onClose?: () => void;
  onLinkChange?: () => void;
  onLinkAriaLabel?: string;
  isLinkActive?: boolean;
  linkedConversationHref?: string;
  className?: string;
  onStageChange?: (
    stageName: string,
    options?: { sentTemplateMessage?: string; scheduledSendAtIso?: string }
  ) => void;
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
  onStageChange,
}: RepairDetailsPanelProps) {
  const [workflowStages, setWorkflowStages] = useState<StoredWorkflowStage[]>(() =>
    readStoredWorkflowStages(defaultWorkflowStages)
  );
  const [templates, setTemplates] = useState<StoredTemplate[]>(() => readStoredTemplates(defaultStoredTemplates));
  const [templateConfirmation, setTemplateConfirmation] = useState<{
    stage: StoredWorkflowStage;
    template: StoredTemplate;
    variableValues: string[];
  } | null>(null);
  const visibleWorkflowStages = useMemo(() => filterVisibleWorkflowStages(workflowStages), [workflowStages]);

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

  useEffect(() => {
    const refreshTemplates = () => {
      setTemplates(readStoredTemplates(defaultStoredTemplates));
    };

    refreshTemplates();
    window.addEventListener("templates:changed", refreshTemplates);
    window.addEventListener("storage", refreshTemplates);

    return () => {
      window.removeEventListener("templates:changed", refreshTemplates);
      window.removeEventListener("storage", refreshTemplates);
    };
  }, []);

  const currentStageIndex = useMemo(
    () => visibleWorkflowStages.findIndex((stage) => stage.name === repair.stage),
    [repair.stage, visibleWorkflowStages]
  );

  const resolveRepairField = (field?: string) => {
    if (field === "customerName") return repair.customerName;
    if (field === "customerPhone") return repair.customerPhone;
    if (field === "assetName") return repair.assetName;
    if (field === "title") return repair.title;
    if (field === "description") return repair.description;
    if (field === "stage") return repair.stage;
    if (field === "priority") return repair.priority;
    return "";
  };

  const buildVariableDefaults = (template: StoredTemplate) =>
    (template.variables ?? []).map((variable) =>
      variable.mode === "repair_field"
        ? resolveRepairField(variable.repairField)
        : variable.manualValue ?? ""
    );

  const fillTemplateBody = (template: StoredTemplate, variableValues: string[]) =>
    template.body.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, rawIndex) => {
      const value = variableValues[Number(rawIndex) - 1];
      return value && value.trim().length > 0 ? value : match;
    });

  const handleStageSelect = (stage: StoredWorkflowStage) => {
    if (!onStageChange || stage.name === repair.stage) return;

    if (stage.templateAutomationEnabled && stage.templateId) {
      const template = templates.find((item) => item.id === stage.templateId);
      if (template) {
        setTemplateConfirmation({
          stage,
          template,
          variableValues: buildVariableDefaults(template)
        });
        return;
      }
    }

    onStageChange(stage.name);
  };

  const templatePreview = templateConfirmation
    ? fillTemplateBody(templateConfirmation.template, templateConfirmation.variableValues)
    : "";
  const templateButtons = templateConfirmation?.template.buttons ?? [];
  const hasEmptyVariableValues = templateConfirmation
    ? (templateConfirmation.template.variables ?? []).some((_, index) => !(templateConfirmation.variableValues[index] ?? "").trim())
    : false;
  const buildTemplateMessageWithButtons = (
    body: string,
    buttons: StoredTemplate["buttons"] = []
  ) => {
    const formattedButtons = (buttons ?? [])
      .map((button, index) => {
        const text = button.text.trim() || `Button ${index + 1}`;
        return `• ${text}`;
      })
      .join("\n");

    return formattedButtons.length > 0
      ? `${body}\n\nButtons:\n${formattedButtons}`
      : body;
  };

  const buildScheduledSendAtIso = (stage: StoredWorkflowStage) => {
    if (!stage.templateSendDelayEnabled) return undefined;
    const delayHours = Math.max(0, stage.templateSendDelayHours ?? 0);
    const delayMinutes = Math.max(0, stage.templateSendDelayMinutes ?? 0);
    const totalDelayMinutes = delayHours * 60 + delayMinutes;
    if (totalDelayMinutes <= 0) return undefined;

    return new Date(Date.now() + totalDelayMinutes * 60 * 1000).toISOString();
  };

  return (
    <>
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
          {visibleWorkflowStages.map((stage, index) => {
          const isCurrent = index === currentStageIndex;
          const isPrevious = currentStageIndex >= 0 && index < currentStageIndex;
          const isUpcoming = currentStageIndex < 0 || index > currentStageIndex;

          return (
            <button
              type="button"
              key={stage.id}
              className="flex w-full items-center gap-2.5 rounded-2xl border border-[#253149] bg-[#121b2b]/65 px-3 py-2.5 text-left text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] hover:shadow-[0_10px_24px_rgba(0,0,0,0.12)] disabled:cursor-default"
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
              onClick={() => handleStageSelect(stage)}
              disabled={!onStageChange || isCurrent}
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
              <span className="text-sm font-semibold text-white">{stage.name}</span>
            </button>
          );
          })}
        </div>
      </div>
      </aside>

      {templateConfirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] p-6 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Confirm template send</h2>
              <button
                type="button"
                onClick={() => setTemplateConfirmation(null)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-200"
                aria-label="Close template confirmation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-slate-700">
              Moving to <span className="font-semibold">{templateConfirmation.stage.name}</span> will send template{" "}
              <span className="font-semibold">{templateConfirmation.template.name}</span>{" "}
              {templateConfirmation.stage.templateSendDelayEnabled
                ? `after ${templateConfirmation.stage.templateSendDelayHours ?? 0} hour(s) and ${templateConfirmation.stage.templateSendDelayMinutes ?? 0} minute(s).`
                : "immediately."}
            </p>

            {(templateConfirmation.template.variables ?? []).length > 0 ? (
              <div className="mt-4 space-y-3">
                <h3 className="text-base font-semibold text-slate-800">Variables</h3>
                {(templateConfirmation.template.variables ?? []).map((variable, index) => (
                  <div key={variable.id} className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700">
                      {variable.name || variable.label || variable.key || `Variable ${index + 1}`}
                    </label>
                    <input
                      type="text"
                      value={templateConfirmation.variableValues[index] ?? ""}
                      onChange={(event) =>
                        setTemplateConfirmation((prev) => {
                          if (!prev) return prev;
                          const nextValues = [...prev.variableValues];
                          nextValues[index] = event.target.value;
                          return { ...prev, variableValues: nextValues };
                        })
                      }
                      className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#30b5a5]"
                    />
                  </div>
                ))}
                {hasEmptyVariableValues ? (
                  <p className="text-sm font-medium text-amber-700">Fill in all variables before sending this template.</p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Template preview</h3>
              <div className="mt-2 rounded-lg border border-[#d7dce3] bg-[#f8fafc] p-3">
                <div className="text-sm leading-6 text-slate-700">{templatePreview}</div>
                {templateButtons.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[#d7dce3] pt-3">
                    {templateButtons.map((button) => {
                      const normalizedType = button.type.toUpperCase();
                      const isQuickReply = normalizedType === "QUICK_REPLY";
                      return (
                        <span
                          key={button.id}
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${isQuickReply ? "border-[#b8d8ff] bg-[#eef6ff] text-[#285b9b]" : "border-[#b8e8e2] bg-[#ecfbf8] text-[#16786b]"}`}
                        >
                          {button.text.trim() || "Button"}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setTemplateConfirmation(null)}
                className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onStageChange?.(templateConfirmation.stage.name);
                  setTemplateConfirmation(null);
                }}
                className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Not Send
              </button>
              <button
                type="button"
                onClick={() => {
                  if (hasEmptyVariableValues) return;
                  onStageChange?.(templateConfirmation.stage.name, {
                    sentTemplateMessage: buildTemplateMessageWithButtons(
                      templatePreview,
                      templateButtons
                    ),
                    scheduledSendAtIso: buildScheduledSendAtIso(templateConfirmation.stage),
                  });
                  setTemplateConfirmation(null);
                }}
                disabled={hasEmptyVariableValues}
                className="rounded-xl bg-[#2fb2a3] px-5 py-2 text-sm font-semibold text-white hover:bg-[#2a9f91] disabled:cursor-not-allowed disabled:bg-[#9fd8d2] disabled:text-white/90"
              >
                Send template
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
