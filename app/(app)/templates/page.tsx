"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Plus, MoreHorizontal, X, ChevronDown, Pencil, Trash2 } from "lucide-react";
import clsx from "clsx";

import { defaultStoredTemplates, readStoredTemplates, writeStoredTemplates } from "@/lib/template-store";

type TemplateVariable = {
  id: string;
  key: string;
  label: string;
  index: number;
  source?: string;
  mode: "manual" | "repair_field";
  manualValue: string;
  repairField: "customerName" | "customerPhone" | "assetName" | "title" | "description" | "stage" | "priority";
};

type TemplateButton = {
  id: string;
  type: "quick_reply" | "url" | "phone";
  text: string;
  value?: string;
};

type Template = {
  id: string;
  name: string;
  category: string;
  language: string;
  body: string;
  active: boolean;
  variables: TemplateVariable[];
  buttons: TemplateButton[];
};

type TemplateFormValues = {
  name: string;
  category: string;
  language: string;
  body: string;
  active: boolean;
  variables: TemplateVariable[];
  buttons: TemplateButton[];
};

type QuickReply = {
  id: string;
  name: string;
  body: string;
};

const emptyTemplateForm: TemplateFormValues = {
  name: "",
  category: "General",
  language: "Dutch",
  body: "",
  active: true,
  variables: [],
  buttons: []
};

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

function writeStoredQuickReplies(items: QuickReply[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(quickReplyStorageKey, JSON.stringify(items));
  window.dispatchEvent(new Event("templates:changed"));
}

function categoryBadgeClass(category: string) {
  if (category.toLowerCase() === "pickup") {
    return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
  }

  if (category.toLowerCase() === "update") {
    return "border-blue-500/40 bg-blue-500/10 text-blue-300";
  }

  return "border-slate-600 bg-slate-700/30 text-slate-300";
}

function templateToFormValues(template: Template): TemplateFormValues {
  const languageMap: Record<string, string> = {
    nl: "Dutch",
    en: "English",
    de: "German"
  };

  return {
    name: template.name,
    category: template.category,
    language: languageMap[template.language] ?? "Dutch",
    body: template.body,
    active: template.active,
    variables: (template.variables ?? []).map((variable, index) => {
      const normalizedIndex = typeof variable.index === "number" && Number.isFinite(variable.index) ? Math.max(1, variable.index) : index + 1;
      const fallbackLabel = (variable as { label?: string; name?: string }).label ?? (variable as { name?: string }).name;

      return {
        id: variable.id,
        key: variable.key ?? `{{${normalizedIndex}}}`,
        label: fallbackLabel?.trim() || `Variable ${normalizedIndex}`,
        index: normalizedIndex,
        source: variable.source,
        mode: variable.mode,
        manualValue: variable.manualValue ?? "",
        repairField: variable.repairField ?? "customerName"
      };
    }),
    buttons: (template.buttons ?? []).map((button) => ({ ...button }))
  };
}

const placeholderRegex = /{{(\d+)}}/g;
const strictPlaceholderRegex = /^{{\d+}}$/;

type NormalizedTemplateDraft = {
  body: string;
  variables: TemplateVariable[];
};

function toPlaceholder(index: number) {
  return `{{${index}}}`;
}

function createVariable(index: number): TemplateVariable {
  return {
    id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    key: toPlaceholder(index),
    label: `Variable ${index}`,
    index,
    source: "manual",
    mode: "manual",
    manualValue: "",
    repairField: "customerName"
  };
}

function getUsedPlaceholderIndexes(body: string): number[] {
  const found = [...body.matchAll(placeholderRegex)].map((match) => Number(match[1])).filter((value) => Number.isInteger(value) && value > 0);
  return [...new Set(found)];
}

function syncVariablesMetadata(variables: TemplateVariable[]) {
  return [...variables]
    .sort((a, b) => a.index - b.index)
    .map((variable, position) => {
      const nextIndex = position + 1;
      const label = variable.label.trim() || `Variable ${nextIndex}`;
      return {
        ...variable,
        index: nextIndex,
        key: toPlaceholder(nextIndex),
        label,
        source: variable.mode === "repair_field" ? `repair.${variable.repairField}` : variable.source ?? "manual"
      };
    });
}

function normalizeBodyAndVariables(body: string, variables: TemplateVariable[]): NormalizedTemplateDraft {
  const usedIndexes = getUsedPlaceholderIndexes(body);
  const sortedUsed = [...usedIndexes].sort((a, b) => a - b);
  const indexMap = new Map<number, number>(sortedUsed.map((oldIndex, position) => [oldIndex, position + 1]));

  const normalizedBody = body.replace(placeholderRegex, (token, value) => {
    const mapped = indexMap.get(Number(value));
    return mapped ? toPlaceholder(mapped) : token;
  });

  const byIndex = new Map(variables.map((variable) => [variable.index, variable]));
  const normalizedVariables = sortedUsed.map((oldIndex, position) => {
    const nextIndex = position + 1;
    const existing = byIndex.get(oldIndex);
    if (!existing) {
      return createVariable(nextIndex);
    }

    return {
      ...existing,
      index: nextIndex,
      key: toPlaceholder(nextIndex),
      label: existing.label.trim() || `Variable ${nextIndex}`,
      source: existing.mode === "repair_field" ? `repair.${existing.repairField}` : existing.source ?? "manual"
    };
  });

  return {
    body: normalizedBody,
    variables: normalizedVariables
  };
}

function renderPreviewTokens(body: string, variables: TemplateVariable[]) {
  const variableByIndex = new Map(variables.map((variable) => [variable.index, variable]));
  const parts: Array<{ type: "text"; value: string } | { type: "token"; index: number; label: string }> = [];
  let cursor = 0;

  body.replace(placeholderRegex, (match, value, offset) => {
    if (offset > cursor) {
      parts.push({ type: "text", value: body.slice(cursor, offset) });
    }

    const index = Number(value);
    const variable = variableByIndex.get(index);
    parts.push({
      type: "token",
      index,
      label: variable?.label?.trim() || `Variable ${index}`
    });

    cursor = offset + match.length;
    return match;
  });

  if (cursor < body.length) {
    parts.push({ type: "text", value: body.slice(cursor) });
  }

  if (parts.length === 0) {
    return <span className="text-slate-400">Message preview will appear here.</span>;
  }

  return parts.map((part, index) => {
    if (part.type === "text") {
      return <span key={`text_${index}`}>{part.value}</span>;
    }

    return (
      <span key={`token_${index}`} className="mx-0.5 inline-flex items-center rounded-md border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-700">
        {part.label}
      </span>
    );
  });
}

function TemplateModal({
  mode,
  initialValues,
  onClose,
  onSubmit
}: {
  mode: "create" | "edit";
  initialValues: TemplateFormValues;
  onClose: () => void;
  onSubmit: (values: TemplateFormValues) => void;
}) {
  const [values, setValues] = useState<TemplateFormValues>({
    ...initialValues,
    variables: syncVariablesMetadata(initialValues.variables)
  });
  const [showAddButtonMenu, setShowAddButtonMenu] = useState(false);
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [bodySelection, setBodySelection] = useState({ start: 0, end: 0 });
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const hasCtaButton = values.buttons.some((button) => button.type === "url" || button.type === "phone");
  const quickReplyCount = values.buttons.filter((button) => button.type === "quick_reply").length;

  const normalizedButtonLabels = values.buttons.map((button) => button.text.trim().toLowerCase());
  const duplicateButtonIndexes = new Set(
    normalizedButtonLabels
      .map((label, index) => (label.length > 0 && normalizedButtonLabels.indexOf(label) !== index ? index : -1))
      .filter((index) => index >= 0)
  );
  const emptyButtonIndexes = new Set(values.buttons.map((button, index) => (button.text.trim().length === 0 ? index : -1)).filter((index) => index >= 0));
  const tooLongButtonIndexes = new Set(values.buttons.map((button, index) => (button.text.trim().length > 20 ? index : -1)).filter((index) => index >= 0));
  const ctaNeedsValueIndexes = new Set(
    values.buttons
      .map((button, index) => ((button.type === "url" || button.type === "phone") && !button.value?.trim() ? index : -1))
      .filter((index) => index >= 0)
  );

  const usedPlaceholderIndexes = useMemo(() => getUsedPlaceholderIndexes(values.body), [values.body]);
  const sortedUsedIndexes = useMemo(() => [...usedPlaceholderIndexes].sort((a, b) => a - b), [usedPlaceholderIndexes]);
  const variableIndexes = new Set(values.variables.map((variable) => variable.index));
  const missingVariableIndexes = sortedUsedIndexes.filter((index) => !variableIndexes.has(index));
  const orphanVariableIndexes = values.variables.filter((variable) => !usedPlaceholderIndexes.includes(variable.index)).map((variable) => variable.index);

  const invalidPlaceholderFragments = useMemo(() => {
    const braces = values.body.match(/{{[^}]*}}/g) ?? [];
    return braces.filter((fragment) => !strictPlaceholderRegex.test(fragment));
  }, [values.body]);

  const hasSequentialGap = sortedUsedIndexes.some((placeholderIndex, position) => placeholderIndex !== position + 1);
  const hasButtonValidationError =
    duplicateButtonIndexes.size > 0 || emptyButtonIndexes.size > 0 || tooLongButtonIndexes.size > 0 || ctaNeedsValueIndexes.size > 0;

  const isBodyPresent = values.body.trim().length > 0;
  const isValid =
    values.name.trim().length > 0 &&
    isBodyPresent &&
    missingVariableIndexes.length === 0 &&
    invalidPlaceholderFragments.length === 0 &&
    !hasButtonValidationError;

  const quickReplySlotsLeft = Math.max(0, 3 - quickReplyCount);

  const updateVariable = (variableId: string, updater: (variable: TemplateVariable) => TemplateVariable) => {
    setValues((prev) => ({
      ...prev,
      variables: syncVariablesMetadata(prev.variables.map((variable) => (variable.id === variableId ? updater(variable) : variable)))
    }));
  };

  const updateButton = (buttonId: string, updater: (button: TemplateButton) => TemplateButton) => {
    setValues((prev) => ({
      ...prev,
      buttons: prev.buttons.map((button) => (button.id === buttonId ? updater(button) : button))
    }));
  };

  const addVariableDefinition = () => {
    setValues((prev) => {
      const nextIndex = prev.variables.length + 1;
      return {
        ...prev,
        variables: [...syncVariablesMetadata(prev.variables), createVariable(nextIndex)]
      };
    });
  };

  const insertVariableToken = (variable: TemplateVariable) => {
    const textarea = bodyTextareaRef.current;
    const fallbackPosition = values.body.length;
    const selectionStart = textarea?.selectionStart ?? bodySelection.start ?? fallbackPosition;
    const selectionEnd = textarea?.selectionEnd ?? bodySelection.end ?? selectionStart;
    const nextBody = `${values.body.slice(0, selectionStart)}${variable.key}${values.body.slice(selectionEnd)}`;
    const nextCursorPosition = selectionStart + variable.key.length;

    setValues((prev) => ({ ...prev, body: nextBody }));
    setBodySelection({ start: nextCursorPosition, end: nextCursorPosition });
    setShowVariablePicker(false);

    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid) return;

    const normalized = normalizeBodyAndVariables(values.body.trim(), syncVariablesMetadata(values.variables));

    onSubmit({
      ...values,
      name: values.name.trim(),
      body: normalized.body,
      variables: normalized.variables.map((variable) => ({
        ...variable,
        label: variable.label.trim(),
        manualValue: variable.manualValue.trim()
      })),
      buttons: values.buttons.map((button) => ({
        ...button,
        text: button.text.trim(),
        value: button.value?.trim()
      }))
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#02050d]/80 px-4 py-6 backdrop-blur-sm sm:items-center sm:py-8">
      <div className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-5">
          <h2 className="text-2xl font-semibold">{mode === "create" ? "Create Template" : "Edit Template"}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-200" aria-label="Close template modal">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="subtle-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div>
              <label htmlFor="template-name" className="mb-2 block text-sm font-medium text-slate-700">
                Name *
              </label>
              <input
                id="template-name"
                className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
                value={values.name}
                onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="template-category" className="mb-2 block text-sm font-medium text-slate-700">
                  Category
                </label>
                <div className="relative">
                  <select
                    id="template-category"
                    className="w-full appearance-none rounded-xl border border-[#cdd5e2] bg-white px-3 py-2 text-sm"
                    value={values.category}
                    onChange={(event) => setValues((prev) => ({ ...prev, category: event.target.value }))}
                  >
                    <option>General</option>
                    <option>Update</option>
                    <option>Pickup</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
                </div>
              </div>

              <div>
                <label htmlFor="template-language" className="mb-2 block text-sm font-medium text-slate-700">
                  Language
                </label>
                <div className="relative">
                  <select
                    id="template-language"
                    className="w-full appearance-none rounded-xl border border-[#cdd5e2] bg-white px-3 py-2 text-sm"
                    value={values.language}
                    onChange={(event) => setValues((prev) => ({ ...prev, language: event.target.value }))}
                  >
                    <option>Dutch</option>
                    <option>English</option>
                    <option>German</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#d7dce3] bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Body</h3>
                  <p className="text-xs text-slate-500">Raw body stores WhatsApp placeholders like {"{{1}}"}. Preview below shows human-friendly labels.</p>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#2fb2a3]/40 bg-[#2fb2a3]/10 px-3 py-1.5 text-xs font-semibold text-[#1f8e82] hover:bg-[#2fb2a3]/20"
                    onClick={() => setShowVariablePicker((prev) => !prev)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Variable
                  </button>
                  {showVariablePicker ? (
                    <div className="absolute right-0 top-9 z-20 w-72 rounded-lg border border-[#d7dce3] bg-white p-1 shadow-lg">
                      {values.variables.length > 0 ? values.variables.map((variable) => (
                        <button
                          key={variable.id}
                          type="button"
                          className="flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-slate-100"
                          onClick={() => insertVariableToken(variable)}
                        >
                          <span className="text-sm font-medium text-slate-700">{variable.label} <span className="text-xs text-slate-500">({variable.key})</span></span>
                          <span className="text-xs text-slate-500">{variable.mode === "repair_field" ? `Source: repair.${variable.repairField}` : "Source: manual"}</span>
                        </button>
                      )) : <p className="px-3 py-2 text-xs text-slate-500">No variables available yet.</p>}
                      <button
                        type="button"
                        className="mt-1 flex w-full items-center rounded-md border border-dashed border-[#bfc9d8] px-3 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        onClick={() => {
                          const nextIndex = values.variables.length + 1;
                          const variable = createVariable(nextIndex);
                          setValues((prev) => ({ ...prev, variables: [...syncVariablesMetadata(prev.variables), variable] }));
                          insertVariableToken(variable);
                        }}
                      >
                        + Create and insert new variable
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <textarea
                id="body-preview"
                ref={bodyTextareaRef}
                className="min-h-28 w-full rounded-xl border border-[#cdd5e2] bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#30b5a5]"
                placeholder="Hello {{1}}, your repair is {{2}}."
                value={values.body}
                onClick={(event) => setBodySelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })}
                onKeyUp={(event) => setBodySelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })}
                onSelect={(event) => setBodySelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })}
                onChange={(event) => {
                  setValues((prev) => ({ ...prev, body: event.target.value }));
                  setBodySelection({ start: event.target.selectionStart, end: event.target.selectionEnd });
                }}
              />

              <div className="mt-3 rounded-lg border border-[#d7dce3] bg-[#f8fafc] p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Live preview</div>
                <div className="text-sm leading-6 text-slate-700">{renderPreviewTokens(values.body, values.variables)}</div>
              </div>

              {!isBodyPresent ? <p className="mt-2 text-xs text-red-500">Body cannot be empty.</p> : null}
              {invalidPlaceholderFragments.length > 0 ? <p className="mt-2 text-xs text-red-500">Invalid placeholder format found. Use only values like {"{{1}}"}.</p> : null}
              {missingVariableIndexes.length > 0 ? <p className="mt-2 text-xs text-red-500">Missing variable definitions for: {missingVariableIndexes.map((index) => toPlaceholder(index)).join(", ")}.</p> : null}
              {hasSequentialGap ? <p className="mt-2 text-xs text-amber-600">Placeholders will be normalized to sequential order on save for API compatibility.</p> : null}
            </div>

            <div className="rounded-xl border border-[#d7dce3] bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Variables</h3>
                  <p className="text-xs text-slate-500">Each variable stores index/key/label metadata for backend mapping.</p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#2fb2a3]/40 bg-[#2fb2a3]/10 px-3 py-1.5 text-xs font-semibold text-[#1f8e82] hover:bg-[#2fb2a3]/20"
                  onClick={addVariableDefinition}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add variable
                </button>
              </div>

              {values.variables.length > 0 ? (
                <div className="space-y-3">
                  {values.variables.map((variable) => (
                    <div key={variable.id} className="rounded-lg border border-[#d7dce3] bg-[#f8fafc] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-500">Placeholder {variable.key}</div>
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-500 hover:text-red-600"
                          onClick={() => setValues((prev) => ({ ...prev, variables: syncVariablesMetadata(prev.variables.filter((item) => item.id !== variable.id)) }))}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          className="w-full rounded-lg border border-[#cdd5e2] bg-white px-3 py-2 text-sm"
                          placeholder="Variable label"
                          value={variable.label}
                          onChange={(event) => updateVariable(variable.id, (current) => ({ ...current, label: event.target.value }))}
                        />
                        <div className="relative">
                          <select
                            className="w-full appearance-none rounded-lg border border-[#cdd5e2] bg-white px-3 py-2 text-sm"
                            value={variable.mode}
                            onChange={(event) =>
                              updateVariable(variable.id, (current) => ({
                                ...current,
                                mode: event.target.value as TemplateVariable["mode"],
                                source: event.target.value === "repair_field" ? `repair.${current.repairField}` : "manual"
                              }))
                            }
                          >
                            <option value="manual">Manual</option>
                            <option value="repair_field">Connect to repair</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
                        </div>
                      </div>

                      {variable.mode === "manual" ? (
                        <input
                          className="mt-3 w-full rounded-lg border border-[#cdd5e2] bg-white px-3 py-2 text-sm"
                          placeholder="Manual default value"
                          value={variable.manualValue}
                          onChange={(event) => updateVariable(variable.id, (current) => ({ ...current, manualValue: event.target.value, source: "manual" }))}
                        />
                      ) : (
                        <div className="relative mt-3">
                          <select
                            className="w-full appearance-none rounded-lg border border-[#cdd5e2] bg-white px-3 py-2 text-sm"
                            value={variable.repairField}
                            onChange={(event) =>
                              updateVariable(variable.id, (current) => ({
                                ...current,
                                repairField: event.target.value as TemplateVariable["repairField"],
                                source: `repair.${event.target.value}`
                              }))
                            }
                          >
                            <option value="customerName">Customer name</option>
                            <option value="customerPhone">Customer phone</option>
                            <option value="assetName">Device name</option>
                            <option value="title">Repair title</option>
                            <option value="description">Repair description</option>
                            <option value="stage">Repair stage</option>
                            <option value="priority">Repair priority</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No variables yet. Click “Add variable”.</p>
              )}
              {orphanVariableIndexes.length > 0 ? (
                <p className="mt-3 text-xs text-amber-600">Unused variables detected ({orphanVariableIndexes.map((index) => toPlaceholder(index)).join(", ")}); they will be removed during save normalization.</p>
              ) : null}
            </div>

            <div className="rounded-xl border border-[#d7dce3] bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Buttons</h3>
                  <p className="text-xs text-slate-500">
                    {quickReplyCount > 0 ? `${quickReplyCount}/3 quick replies used` : "Add quick replies or one CTA button."}
                  </p>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#2fb2a3]/40 bg-[#2fb2a3]/10 px-3 py-1.5 text-xs font-semibold text-[#1f8e82] hover:bg-[#2fb2a3]/20 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => setShowAddButtonMenu((prev) => !prev)}
                    disabled={hasCtaButton || quickReplyCount >= 3}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Button
                  </button>
                  {showAddButtonMenu ? (
                    <div className="absolute right-0 top-9 z-10 w-44 rounded-lg border border-[#d7dce3] bg-white p-1 shadow-lg">
                      <button
                        type="button"
                        disabled={hasCtaButton || quickReplyCount >= 3}
                        className="flex w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => {
                          setValues((prev) => ({
                            ...prev,
                            buttons: [...prev.buttons, { id: `btn_${Date.now()}`, type: "quick_reply", text: "" }]
                          }));
                          setShowAddButtonMenu(false);
                        }}
                      >
                        Quick Reply
                      </button>
                      <button
                        type="button"
                        disabled={hasCtaButton || quickReplyCount > 0}
                        className="flex w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => {
                          setValues((prev) => ({
                            ...prev,
                            buttons: [...prev.buttons, { id: `btn_${Date.now()}`, type: "url", text: "", value: "" }]
                          }));
                          setShowAddButtonMenu(false);
                        }}
                      >
                        Call To Action
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {values.buttons.length > 0 ? (
                <div className="space-y-3">
                  {values.buttons.map((button, index) => (
                    <div key={button.id} className="rounded-lg border border-[#d7dce3] bg-[#f8fafc] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-500">{button.type === "quick_reply" ? "Quick Reply" : "CTA"}</div>
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-500 hover:text-red-600"
                          onClick={() =>
                            setValues((prev) => ({
                              ...prev,
                              buttons: prev.buttons.filter((item) => item.id !== button.id)
                            }))
                          }
                        >
                          Remove
                        </button>
                      </div>
                      {button.type === "url" || button.type === "phone" ? (
                        <div className="relative mb-3">
                          <select
                            className="w-full appearance-none rounded-lg border border-[#cdd5e2] bg-white px-3 py-2 text-sm"
                            value={button.type}
                            onChange={(event) => updateButton(button.id, (current) => ({ ...current, type: event.target.value as "url" | "phone" }))}
                          >
                            <option value="url">CTA: URL</option>
                            <option value="phone">CTA: Phone</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
                        </div>
                      ) : null}
                      <input
                        className="w-full rounded-lg border border-[#cdd5e2] bg-white px-3 py-2 text-sm"
                        placeholder="Button text (max 20 chars)"
                        value={button.text}
                        maxLength={40}
                        onChange={(event) => updateButton(button.id, (current) => ({ ...current, text: event.target.value }))}
                      />
                      <div className="mt-1 text-xs text-slate-500">{button.text.trim().length}/20</div>
                      {emptyButtonIndexes.has(index) ? <p className="mt-1 text-xs text-red-500">Button text cannot be empty.</p> : null}
                      {tooLongButtonIndexes.has(index) ? <p className="mt-1 text-xs text-red-500">Button text cannot exceed 20 characters.</p> : null}
                      {duplicateButtonIndexes.has(index) ? <p className="mt-1 text-xs text-red-500">Duplicate button label is not allowed.</p> : null}
                      {button.type === "url" || button.type === "phone" ? (
                        <>
                          <input
                            className="mt-3 w-full rounded-lg border border-[#cdd5e2] bg-white px-3 py-2 text-sm"
                            placeholder={button.type === "url" ? "https://example.com" : "+31123456789"}
                            value={button.value ?? ""}
                            onChange={(event) => updateButton(button.id, (current) => ({ ...current, value: event.target.value }))}
                          />
                          {ctaNeedsValueIndexes.has(index) ? <p className="mt-1 text-xs text-red-500">CTA requires a URL or phone number.</p> : null}
                        </>
                      ) : null}
                    </div>
                  ))}
                  {quickReplyCount >= 3 ? <p className="text-xs text-amber-600">Maximum of 3 quick replies reached.</p> : null}
                  {hasCtaButton ? <p className="text-xs text-amber-600">CTA is exclusive and cannot be combined with other button types.</p> : null}
                  {!hasCtaButton && quickReplyCount > 0 ? <p className="text-xs text-slate-500">{quickReplySlotsLeft} quick reply slot(s) remaining.</p> : null}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No buttons yet. Click “Add Button”.</p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                className={clsx("relative inline-flex h-7 w-12 items-center rounded-full transition", values.active ? "bg-[#2fb2a3]" : "bg-slate-300")}
                onClick={() => setValues((prev) => ({ ...prev, active: !prev.active }))}
                aria-label="Toggle active"
              >
                <span className={clsx("inline-block h-5 w-5 transform rounded-full bg-white transition", values.active ? "translate-x-6" : "translate-x-1")} />
              </button>
              <span className="text-sm text-slate-700">Active</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#e2e8f0] bg-[#f4f6fa] px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="submit"
              className={clsx("rounded-xl px-5 py-2 text-sm font-semibold text-white", isValid ? "bg-[#2fb2a3] hover:bg-[#2a9f91]" : "cursor-not-allowed bg-slate-400")}
              disabled={!isValid}
            >
              {mode === "create" ? "Create" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteTemplateModal({ templateName, onCancel, onConfirm }: { templateName: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] p-6 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <h2 className="text-xl font-semibold">Delete template</h2>
        <p className="mt-2 text-sm text-slate-600">
          This template will be permanently deleted: <span className="font-semibold">{templateName}</span>.
        </p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickReplyModal({
  mode,
  initialValues,
  onClose,
  onSubmit
}: {
  mode: "create" | "edit";
  initialValues: { name: string; body: string };
  onClose: () => void;
  onSubmit: (values: { name: string; body: string }) => void;
}) {
  const [name, setName] = useState(initialValues.name);
  const [body, setBody] = useState(initialValues.body);
  const isValid = name.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="text-2xl font-semibold">{mode === "create" ? "Add Quick Reply" : "Edit Quick Reply"}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-200" aria-label="Close quick reply modal">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          className="space-y-5 px-6 pb-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isValid) return;
            onSubmit({ name: name.trim(), body: body.trim() });
          }}
        >
          <div>
            <label htmlFor="quick-reply-name" className="mb-2 block text-sm font-medium text-slate-700">Name *</label>
            <input id="quick-reply-name" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#30b5a5]" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label htmlFor="quick-reply-body" className="mb-2 block text-sm font-medium text-slate-700">Body preview *</label>
            <textarea id="quick-reply-body" className="min-h-24 w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#30b5a5]" value={body} onChange={(event) => setBody(event.target.value)} />
          </div>
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
            <button type="submit" className={clsx("rounded-xl px-5 py-2 text-sm font-semibold text-white", isValid ? "bg-[#2fb2a3] hover:bg-[#2a9f91]" : "cursor-not-allowed bg-slate-400")} disabled={!isValid}>{mode === "create" ? "Add Quick Reply" : "Save Quick Reply"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteQuickReplyModal({ quickReplyName, onCancel, onConfirm }: { quickReplyName: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] p-6 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <h2 className="text-xl font-semibold">Delete quick reply</h2>
        <p className="mt-2 text-sm text-slate-600">
          This quick reply will be permanently deleted: <span className="font-semibold">{quickReplyName}</span>.
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
          <button type="button" onClick={onConfirm} className="rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600">Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(() => readStoredTemplates(defaultStoredTemplates).map((template) => ({
    ...template,
    variables: (template.variables ?? []).map((variable, index) => {
      const legacyVariable = variable as TemplateVariable & { name?: string };
      const normalizedIndex = typeof variable.index === "number" && Number.isFinite(variable.index) ? Math.max(1, variable.index) : index + 1;

      return {
        id: variable.id,
        key: variable.key ?? `{{${normalizedIndex}}}`,
        label: variable.label ?? legacyVariable.name ?? `Variable ${normalizedIndex}`,
        index: normalizedIndex,
        source: variable.source,
        mode: variable.mode,
        manualValue: variable.manualValue ?? "",
        repairField: variable.repairField ?? "customerName"
      };
    }),
    buttons: (template.buttons ?? []).map((button) => ({ ...button }))
  })));
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(() => readStoredQuickReplies(initialQuickReplies));
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateQuickReplyModalOpen, setIsCreateQuickReplyModalOpen] = useState(false);
  const [editingQuickReplyId, setEditingQuickReplyId] = useState<string | null>(null);
  const [deletingQuickReplyId, setDeletingQuickReplyId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const editingTemplate = templates.find((template) => template.id === editingTemplateId) ?? null;

  useEffect(() => {
    writeStoredTemplates(templates);
  }, [templates]);

  useEffect(() => {
    writeStoredQuickReplies(quickReplies);
  }, [quickReplies]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-action-menu='true']")) return;
      setOpenMenuId(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const deletingTemplate = templates.find((template) => template.id === deletingTemplateId) ?? null;
  const editingQuickReply = quickReplies.find((reply) => reply.id === editingQuickReplyId) ?? null;
  const deletingQuickReply = quickReplies.find((reply) => reply.id === deletingQuickReplyId) ?? null;

  const toStoredLanguage = (language: string) => {
    if (language === "Dutch") return "nl";
    if (language === "English") return "en";
    return "de";
  };

  const handleCreateTemplate = (values: TemplateFormValues) => {
    const newTemplate: Template = {
      id: `tpl_${Date.now()}`,
      name: values.name.trim(),
      category: values.category,
      language: toStoredLanguage(values.language),
      body: values.body.trim(),
      active: values.active,
      variables: values.variables,
      buttons: values.buttons
    };

    setTemplates((prev) => [newTemplate, ...prev]);
    setIsCreateModalOpen(false);
  };

  const handleEditTemplate = (templateId: string, values: TemplateFormValues) => {
    setTemplates((prev) =>
      prev.map((template) => {
        if (template.id !== templateId) return template;

        return {
          ...template,
          name: values.name.trim(),
          category: values.category,
          language: toStoredLanguage(values.language),
          body: values.body.trim(),
          active: values.active,
          variables: values.variables,
          buttons: values.buttons
        };
      })
    );

    setEditingTemplateId(null);
  };

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates((prev) => prev.filter((template) => template.id !== templateId));
    setDeletingTemplateId(null);
  };



  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Templates</h1>
            <p className="mt-1 text-sm text-slate-400">Manage WhatsApp message templates</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#28d9c6]/50 bg-[var(--surface-3)]/10 px-5 text-sm font-semibold text-[#69f0df]"
            >
              <Plus className="h-4 w-4" />
              Add Template
            </button>
            <button
              type="button"
              onClick={() => setIsCreateQuickReplyModalOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#28d9c6]/50 bg-[var(--surface-3)]/10 px-5 text-sm font-semibold text-[#69f0df]"
            >
              <Plus className="h-4 w-4" />
              Add Quick Reply
            </button>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <article key={template.id} className="relative rounded-2xl border border-[#253149] bg-[#121b2b]/65 p-5">
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold text-white">{template.name}</h2>
                <button
                  data-action-menu="true"
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-800/70"
                  aria-label={`Open actions for ${template.name}`}
                  onClick={() => setOpenMenuId((prev) => (prev === template.id ? null : template.id))}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

              {openMenuId === template.id ? (
                <div data-action-menu="true" className="absolute right-6 top-14 z-10 w-32 rounded-xl border border-[#d7dce3] bg-[#f4f6fa] p-1 shadow-xl">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-200"
                    onClick={() => {
                      setEditingTemplateId(template.id);
                      setOpenMenuId(null);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50"
                    onClick={() => {
                      setDeletingTemplateId(template.id);
                      setOpenMenuId(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              ) : null}

              <div className={clsx("mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", categoryBadgeClass(template.category))}>{template.category}</div>

              <p className="mt-3 text-sm leading-7 text-slate-400">{template.body}</p>
              {template.buttons.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {template.buttons.map((button) => (
                    <span key={button.id} className="rounded-full border border-[#355073] bg-[#18283f] px-2 py-1 text-xs text-slate-300">
                      {button.type === "quick_reply" ? "Quick reply" : button.type === "url" ? "CTA URL" : "CTA Phone"}: {button.text}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 text-sm text-slate-500">Lang: {template.language}</div>
            </article>
          ))}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Quick Replies</h2>
            <p className="text-sm text-slate-400">Short reusable messages for faster responses.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {quickReplies.map((reply) => (
              <article key={reply.id} className="relative rounded-2xl border border-[#253149] bg-[#121b2b]/65 p-5">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-white">{reply.name}</h3>
                  <button
                    data-action-menu="true"
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-800/70"
                    aria-label={`Open actions for ${reply.name}`}
                    onClick={() => setOpenMenuId((prev) => (prev === reply.id ? null : reply.id))}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
                {openMenuId === reply.id ? (
                  <div data-action-menu="true" className="absolute right-6 top-14 z-10 w-32 rounded-xl border border-[#d7dce3] bg-[#f4f6fa] p-1 shadow-xl">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-200"
                      onClick={() => {
                        setEditingQuickReplyId(reply.id);
                        setOpenMenuId(null);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50"
                      onClick={() => {
                        setDeletingQuickReplyId(reply.id);
                        setOpenMenuId(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                ) : null}
                <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-400">{reply.body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      {isCreateModalOpen ? (
        <TemplateModal mode="create" initialValues={emptyTemplateForm} onClose={() => setIsCreateModalOpen(false)} onSubmit={handleCreateTemplate} />
      ) : null}

      {editingTemplate ? (
        <TemplateModal
          mode="edit"
          initialValues={templateToFormValues(editingTemplate)}
          onClose={() => setEditingTemplateId(null)}
          onSubmit={(values) => handleEditTemplate(editingTemplate.id, values)}
        />
      ) : null}

      {deletingTemplate ? (
        <DeleteTemplateModal
          templateName={deletingTemplate.name}
          onCancel={() => setDeletingTemplateId(null)}
          onConfirm={() => handleDeleteTemplate(deletingTemplate.id)}
        />
      ) : null}

      {isCreateQuickReplyModalOpen ? (
        <QuickReplyModal
          mode="create"
          initialValues={{ name: "", body: "" }}
          onClose={() => setIsCreateQuickReplyModalOpen(false)}
          onSubmit={(values) => {
            setQuickReplies((prev) => [{ id: `qr_${Date.now()}`, name: values.name, body: values.body }, ...prev]);
            setIsCreateQuickReplyModalOpen(false);
          }}
        />
      ) : null}

      {editingQuickReply ? (
        <QuickReplyModal
          mode="edit"
          initialValues={{ name: editingQuickReply.name, body: editingQuickReply.body }}
          onClose={() => setEditingQuickReplyId(null)}
          onSubmit={(values) => {
            setQuickReplies((prev) => prev.map((reply) => (reply.id === editingQuickReply.id ? { ...reply, name: values.name, body: values.body } : reply)));
            setEditingQuickReplyId(null);
          }}
        />
      ) : null}

      {deletingQuickReply ? (
        <DeleteQuickReplyModal
          quickReplyName={deletingQuickReply.name}
          onCancel={() => setDeletingQuickReplyId(null)}
          onConfirm={() => {
            setQuickReplies((prev) => prev.filter((reply) => reply.id !== deletingQuickReply.id));
            setDeletingQuickReplyId(null);
          }}
        />
      ) : null}
    </>
  );
}
