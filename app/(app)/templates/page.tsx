"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Plus, MoreHorizontal, X, ChevronDown, ChevronUp, Pencil, Trash2, Link2 } from "lucide-react";
import clsx from "clsx";
import Link from "next/link";

import { defaultStoredTemplates, readStoredTemplates, writeStoredTemplates } from "@/lib/template-store";
import { defaultWorkflowStages, filterVisibleWorkflowStages, readStoredWorkflowStages, type StoredWorkflowStage } from "@/lib/workflow-stage-store";

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

type TemplateCategory = "UTILITY" | "MARKETING";

type TemplateButton =
  | {
      id: string;
      type: "QUICK_REPLY";
      text: string;
    }
  | {
      id: string;
      type: "URL";
      text: string;
      url: string;
    }
  | {
      id: string;
      type: "PHONE_NUMBER";
      text: string;
      phoneNumber: string;
    };

type Template = {
  id: string;
  name: string;
  category: TemplateCategory;
  language: string;
  body: string;
  active: boolean;
  variables: TemplateVariable[];
  buttons: TemplateButton[];
};

type TemplateFormValues = {
  name: string;
  category: TemplateCategory;
  language: string;
  body: string;
  active: boolean;
  variables: TemplateVariable[];
  buttons: TemplateButton[];
};

const emptyTemplateForm: TemplateFormValues = {
  name: "",
  category: "UTILITY",
  language: "Dutch",
  body: "",
  active: true,
  variables: [],
  buttons: []
};

const CATEGORY_OPTIONS: Array<{ label: string; value: TemplateCategory }> = [
  { label: "Utility", value: "UTILITY" },
  { label: "Marketing", value: "MARKETING" }
];

function normalizeCategory(category?: string): TemplateCategory {
  const value = (category ?? "").toUpperCase().trim();
  if (value === "MARKETING") return "MARKETING";
  if (value === "UTILITY" || value === "GENERAL" || value === "UPDATE" || value === "PICKUP") return "UTILITY";
  return "UTILITY";
}

function normalizeButton(button: { id: string; type: string; text: string; value?: string; url?: string; phoneNumber?: string }): TemplateButton {
  const normalizedType = button.type.toUpperCase();
  if (normalizedType === "URL") {
    return { id: button.id, type: "URL", text: button.text ?? "", url: button.url ?? button.value ?? "" };
  }
  if (normalizedType === "PHONE_NUMBER" || normalizedType === "PHONE") {
    return { id: button.id, type: "PHONE_NUMBER", text: button.text ?? "", phoneNumber: button.phoneNumber ?? button.value ?? "" };
  }
  return { id: button.id, type: "QUICK_REPLY", text: button.text ?? "" };
}

function templateToFormValues(template: Template): TemplateFormValues {
  const languageMap: Record<string, string> = {
    nl: "Dutch",
    en: "English",
    de: "German"
  };

  return {
    name: template.name,
    category: normalizeCategory(template.category),
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
    buttons: (template.buttons ?? []).map((button) => normalizeButton(button))
  };
}

function hasMixedButtonModes(buttons: TemplateButton[]) {
  const hasQuickReply = buttons.some((button) => button.type === "QUICK_REPLY");
  const hasCta = buttons.some((button) => button.type === "URL" || button.type === "PHONE_NUMBER");
  return hasQuickReply && hasCta;
}

function sanitizeButtonsForSave(buttons: TemplateButton[]): TemplateButton[] {
  return buttons.map((button) => {
    if (button.type === "URL") {
      return { ...button, text: button.text.trim(), url: button.url.trim() };
    }
    if (button.type === "PHONE_NUMBER") {
      return { ...button, text: button.text.trim(), phoneNumber: normalizePhoneNumber(button.phoneNumber) };
    }
    return { ...button, text: button.text.trim() };
  });
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

function normalizePhoneNumber(phoneNumber: string) {
  const trimmed = phoneNumber.trim();
  if (!trimmed) return "";

  const normalized = trimmed
    .replace(/\(0\)/g, "")
    .replace(/[^\d+]/g, "")
    .replace(/(?!^)\+/g, "");

  if (!normalized) return "";
  return normalized.startsWith("+") ? normalized : `+${normalized}`;
}

function isValidPhoneNumber(phoneNumber: string) {
  return /^\+[1-9]\d{7,14}$/.test(phoneNumber);
}

function isValidCtaUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return false;

  const templatedUrl = trimmed.replace(/\{\{\s*\d+\s*\}\}/g, "placeholder");

  try {
    const parsed = new URL(templatedUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
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
  const parts: Array<{ type: "text"; value: string } | { type: "token"; index: number; label: string; linked: boolean }> = [];
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
      label: variable?.label?.trim() || `Variable ${index}`,
      linked: variable?.mode === "repair_field"
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
        {part.linked ? <Link2 className="mr-1 h-3 w-3" aria-hidden="true" /> : null}
        {part.label}
      </span>
    );
  });
}

function renderPreviewButtons(buttons: TemplateButton[]) {
  if (buttons.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-[#d7dce3] pt-3">
      {buttons.map((button) => (
        <span
          key={button.id}
          className={clsx(
            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
            button.type === "QUICK_REPLY"
              ? "border-[#b8d8ff] bg-[#eef6ff] text-[#285b9b]"
              : "border-[#b8e8e2] bg-[#ecfbf8] text-[#16786b]"
          )}
        >
          {button.text.trim() || "Button"}
        </span>
      ))}
    </div>
  );
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
  const isTemplateLocked = mode === "edit";
  const [values, setValues] = useState<TemplateFormValues>({
    ...initialValues,
    category: normalizeCategory(initialValues.category),
    variables: syncVariablesMetadata(initialValues.variables),
    buttons: (initialValues.buttons ?? []).map((button) => normalizeButton(button))
  });
  const [showAddButtonMenu, setShowAddButtonMenu] = useState(false);
  const [isVariablesOpen, setIsVariablesOpen] = useState(initialValues.variables.length > 0);
  const [isButtonsOpen, setIsButtonsOpen] = useState(initialValues.buttons.length > 0);
  const [highlightedVariableId, setHighlightedVariableId] = useState<string | null>(null);
  const [highlightedButtonId, setHighlightedButtonId] = useState<string | null>(null);
  const [bodySelection, setBodySelection] = useState({ start: 0, end: 0 });
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const modalScrollRef = useRef<HTMLDivElement | null>(null);
  const buttonPickerRef = useRef<HTMLDivElement | null>(null);
  const variablesSectionRef = useRef<HTMLDivElement | null>(null);
  const buttonsSectionRef = useRef<HTMLDivElement | null>(null);
  const variableInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const buttonInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const quickReplyCount = values.buttons.filter((button) => button.type === "QUICK_REPLY").length;
  const urlCount = values.buttons.filter((button) => button.type === "URL").length;
  const phoneCount = values.buttons.filter((button) => button.type === "PHONE_NUMBER").length;
  const ctaCount = urlCount + phoneCount;
  const hasQuickReplyButtons = quickReplyCount > 0;
  const hasCtaButtons = ctaCount > 0;
  const hasMixedButtonTypes = hasQuickReplyButtons && hasCtaButtons;
  const buttonMode: "QUICK_REPLY" | "CTA" | null = hasQuickReplyButtons ? "QUICK_REPLY" : hasCtaButtons ? "CTA" : null;

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
      .map((button, index) => {
        if (button.type === "URL") return button.url.trim() ? -1 : index;
        if (button.type === "PHONE_NUMBER") return button.phoneNumber.trim() ? -1 : index;
        return -1;
      })
      .filter((index) => index >= 0)
  );
  const invalidUrlIndexes = new Set(
    values.buttons
      .map((button, index) => (button.type === "URL" && button.url.trim() && !isValidCtaUrl(button.url) ? index : -1))
      .filter((index) => index >= 0)
  );
  const invalidPhoneIndexes = new Set(
    values.buttons
      .map((button, index) => {
        if (button.type !== "PHONE_NUMBER") return -1;
        const normalizedPhone = normalizePhoneNumber(button.phoneNumber);
        return button.phoneNumber.trim() && !isValidPhoneNumber(normalizedPhone) ? index : -1;
      })
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

  const hasButtonValidationError =
    hasMixedButtonTypes ||
    duplicateButtonIndexes.size > 0 ||
    emptyButtonIndexes.size > 0 ||
    tooLongButtonIndexes.size > 0 ||
    ctaNeedsValueIndexes.size > 0 ||
    invalidUrlIndexes.size > 0 ||
    invalidPhoneIndexes.size > 0 ||
    quickReplyCount > 3 ||
    ctaCount > 2 ||
    urlCount > 1 ||
    phoneCount > 1;

  const isBodyPresent = values.body.trim().length > 0;
  const isValid =
    values.name.trim().length > 0 &&
    isBodyPresent &&
    (values.category === "UTILITY" || values.category === "MARKETING") &&
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

  const scrollToSection = (section: "variables" | "buttons") => {
    requestAnimationFrame(() => {
      const container = modalScrollRef.current;
      const target = section === "variables" ? variablesSectionRef.current : buttonsSectionRef.current;
      if (!container || !target) return;
      const offset = target.offsetTop - 12;
      container.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
    });
  };

  const addVariable = () => {
    if (isTemplateLocked) return;
    const nextIndex = values.variables.length + 1;
    const variable = createVariable(nextIndex);
    setValues((prev) => ({ ...prev, variables: [...syncVariablesMetadata(prev.variables), variable] }));
    insertVariableToken(variable);
    setIsVariablesOpen(true);
    setIsButtonsOpen(false);
    setHighlightedVariableId(variable.id);
    scrollToSection("variables");
  };

  const toggleButtonPicker = () => {
    if (isTemplateLocked) return;
    setShowAddButtonMenu((prev) => !prev);
    setIsButtonsOpen(true);
    setIsVariablesOpen(false);
    scrollToSection("buttons");
  };

  const addButton = (type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER") => {
    if (isTemplateLocked) return;
    const nextButtonId = `btn_${Date.now()}`;
    setValues((prev) => {
      const nextButton: TemplateButton =
        type === "URL"
          ? { id: nextButtonId, type: "URL", text: "", url: "" }
          : type === "PHONE_NUMBER"
            ? { id: nextButtonId, type: "PHONE_NUMBER", text: "", phoneNumber: "" }
            : { id: nextButtonId, type: "QUICK_REPLY", text: "" };

      return { ...prev, buttons: [...prev.buttons, nextButton] };
    });
    setShowAddButtonMenu(false);
    setIsButtonsOpen(true);
    setIsVariablesOpen(false);
    setHighlightedButtonId(nextButtonId);
    scrollToSection("buttons");
  };

  useEffect(() => {
    if (!highlightedVariableId) return;

    const timeout = window.setTimeout(() => {
      const input = variableInputRefs.current[highlightedVariableId];
      input?.focus();
      input?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      window.setTimeout(() => setHighlightedVariableId(null), 1400);
    }, 80);

    return () => window.clearTimeout(timeout);
  }, [highlightedVariableId, values.variables]);

  useEffect(() => {
    if (!highlightedButtonId) return;

    const timeout = window.setTimeout(() => {
      const input = buttonInputRefs.current[highlightedButtonId];
      input?.focus();
      input?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      window.setTimeout(() => setHighlightedButtonId(null), 1400);
    }, 80);

    return () => window.clearTimeout(timeout);
  }, [highlightedButtonId, values.buttons]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (showAddButtonMenu && buttonPickerRef.current && !buttonPickerRef.current.contains(target)) {
        setShowAddButtonMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowAddButtonMenu(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showAddButtonMenu]);

  const insertVariableToken = (variable: TemplateVariable) => {
    const textarea = bodyTextareaRef.current;
    const fallbackPosition = values.body.length;
    const selectionStart = textarea?.selectionStart ?? bodySelection.start ?? fallbackPosition;
    const selectionEnd = textarea?.selectionEnd ?? bodySelection.end ?? selectionStart;
    const nextBody = `${values.body.slice(0, selectionStart)}${variable.key}${values.body.slice(selectionEnd)}`;
    const nextCursorPosition = selectionStart + variable.key.length;

    setValues((prev) => ({ ...prev, body: nextBody }));
    setBodySelection({ start: nextCursorPosition, end: nextCursorPosition });

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
      category: normalizeCategory(values.category),
      body: normalized.body,
      variables: normalized.variables.map((variable) => ({
        ...variable,
        label: variable.label.trim(),
        manualValue: variable.manualValue.trim()
      })),
      buttons: sanitizeButtonsForSave(values.buttons)
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
          <div ref={modalScrollRef} className="subtle-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {isTemplateLocked ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Existing templates are locked. You can only update the template name and active status.
              </div>
            ) : null}
            <div>
              <label htmlFor="template-name" className="mb-2 block text-sm font-medium text-slate-700">Name *</label>
              <input id="template-name" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]" value={values.name} onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="template-category" className="mb-2 block text-sm font-medium text-slate-700">Category</label>
                <div className="relative">
                  <select id="template-category" disabled={isTemplateLocked} className={clsx("w-full appearance-none rounded-xl border border-[#cdd5e2] bg-white px-3 py-2 text-sm", isTemplateLocked ? "cursor-not-allowed bg-slate-100 text-slate-500" : undefined)} value={values.category} onChange={(event) => setValues((prev) => ({ ...prev, category: normalizeCategory(event.target.value) }))}>
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
                </div>
              </div>

              <div>
                <label htmlFor="template-language" className="mb-2 block text-sm font-medium text-slate-700">Language</label>
                <div className="relative">
                  <select id="template-language" disabled={isTemplateLocked} className={clsx("w-full appearance-none rounded-xl border border-[#cdd5e2] bg-white px-3 py-2 text-sm", isTemplateLocked ? "cursor-not-allowed bg-slate-100 text-slate-500" : undefined)} value={values.language} onChange={(event) => setValues((prev) => ({ ...prev, language: event.target.value }))}>
                    <option>Dutch</option>
                    <option>English</option>
                    <option>German</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#d7dce3] bg-white p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Body</h3>
                <p className="text-xs text-slate-500">Raw body stores WhatsApp placeholders like {"{{1}}"}. Preview below shows human-friendly labels.</p>
              </div>

              <textarea
                id="body-preview"
                ref={bodyTextareaRef}
                className="mt-3 min-h-28 w-full rounded-xl border border-[#cdd5e2] bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#30b5a5]"
                placeholder="Hello {{1}}, your repair is {{2}}."
                value={values.body}
                readOnly={isTemplateLocked}
                onClick={(event) => setBodySelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })}
                onKeyUp={(event) => setBodySelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })}
                onSelect={(event) => setBodySelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })}
                onChange={(event) => {
                  setValues((prev) => ({ ...prev, body: event.target.value }));
                  setBodySelection({ start: event.target.selectionStart, end: event.target.selectionEnd });
                }}
              />

              <div className="mt-3 flex flex-wrap items-center justify-start gap-2">
                <div className="relative">
                  <button type="button" disabled={isTemplateLocked} className={clsx("inline-flex items-center gap-1 rounded-lg border border-[#2fb2a3]/40 bg-[#2fb2a3]/10 px-3 py-1.5 text-xs font-semibold text-[#1f8e82] hover:bg-[#2fb2a3]/20", isTemplateLocked ? "cursor-not-allowed opacity-50" : undefined)} onClick={addVariable}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Variable
                  </button>
                </div>

                <div ref={buttonPickerRef} className="relative">
                  <button type="button" disabled={isTemplateLocked} className={clsx("inline-flex items-center gap-1 rounded-lg border border-[#2fb2a3]/40 bg-[#2fb2a3]/10 px-3 py-1.5 text-xs font-semibold text-[#1f8e82] hover:bg-[#2fb2a3]/20", isTemplateLocked ? "cursor-not-allowed opacity-50" : undefined)} onClick={toggleButtonPicker}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Button
                  </button>
                  {showAddButtonMenu ? (
                    <div className="absolute left-0 top-9 z-10 w-56 rounded-lg border border-[#d7dce3] bg-white p-1 shadow-lg">
                        <div className="mb-1 flex justify-end px-1">
                          <button type="button" className="rounded-md p-1 text-slate-500 hover:bg-slate-100" aria-label="Close button options" onClick={() => setShowAddButtonMenu(false)}>
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <button type="button" disabled={buttonMode === "CTA" || quickReplyCount >= 3} className="flex w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => addButton("QUICK_REPLY")}>Quick Reply</button>
                        <button type="button" disabled={buttonMode === "QUICK_REPLY" || urlCount >= 1 || ctaCount >= 2} className="flex w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => addButton("URL")}>CTA: URL</button>
                        <button type="button" disabled={buttonMode === "QUICK_REPLY" || phoneCount >= 1 || ctaCount >= 2} className="flex w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => addButton("PHONE_NUMBER")}>CTA: Phone</button>
                        {buttonMode === "QUICK_REPLY" ? <p className="px-3 py-2 text-xs text-slate-500">CTA is unavailable while quick replies are present.</p> : null}
                        {buttonMode === "CTA" ? <p className="px-3 py-2 text-xs text-slate-500">Quick replies are unavailable while CTA buttons are present.</p> : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5">
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Template preview</h3>
                <div className="rounded-lg border border-[#d7dce3] bg-[#f8fafc] p-3">
                  <div className="text-sm leading-6 text-slate-700">{renderPreviewTokens(values.body, values.variables)}</div>
                  {renderPreviewButtons(values.buttons)}
                </div>
              </div>

              {!isBodyPresent ? <p className="mt-2 text-xs text-red-500">Body cannot be empty.</p> : null}
              {invalidPlaceholderFragments.length > 0 ? <p className="mt-2 text-xs text-red-500">Invalid placeholder format found. Use only values like {"{{1}}"}.</p> : null}
              {missingVariableIndexes.length > 0 ? <p className="mt-2 text-xs text-red-500">Missing variable definitions for: {missingVariableIndexes.map((index) => toPlaceholder(index)).join(", ")}.</p> : null}
            </div>

            <div ref={variablesSectionRef} className={clsx("rounded-xl border border-[#d7dce3] bg-white", isVariablesOpen ? "p-4" : "px-3 py-2")}>
                <button type="button" className={clsx("flex w-full items-center justify-between rounded-lg px-2 text-left transition-colors hover:bg-slate-50", isVariablesOpen ? "mb-3 min-h-10" : "min-h-8")} onClick={() => setIsVariablesOpen((prev) => !prev)}>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Variables</h3>
                    <p className="text-xs text-slate-500">Each variable stores index/key/label metadata for backend mapping.</p>
                  </div>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d7dce3] bg-white text-slate-500">
                    {isVariablesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </button>

                {isVariablesOpen ? (
                  <div className="space-y-3">
                    {values.variables.length === 0 ? <p className="text-xs text-slate-500">No variables yet. Use Add Variable to create one.</p> : null}
                    {values.variables.map((variable) => (
                      <div key={variable.id} className={clsx("rounded-lg border bg-[#f8fafc] p-3 transition-colors", highlightedVariableId === variable.id ? "border-[#2fb2a3] ring-2 ring-[#2fb2a3]/20" : "border-[#d7dce3]")}>
                        <div className="mb-2 flex items-center justify-between">
                          <div className="inline-flex items-center text-xs font-semibold text-slate-500">
                            {variable.mode === "repair_field" ? <Link2 className="mr-1 h-3.5 w-3.5 text-[#1f8e82]" aria-hidden="true" /> : null}
                            Placeholder {variable.key}
                          </div>
                          <button type="button" disabled={isTemplateLocked} className={clsx("text-xs font-semibold text-red-500 hover:text-red-600", isTemplateLocked ? "cursor-not-allowed opacity-40" : undefined)} onClick={() => setValues((prev) => ({ ...prev, variables: syncVariablesMetadata(prev.variables.filter((item) => item.id !== variable.id)) }))}>Remove</button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input ref={(node) => { variableInputRefs.current[variable.id] = node; }} readOnly={isTemplateLocked} className={clsx("w-full rounded-lg border border-[#cdd5e2] bg-white px-3 py-2 text-sm", isTemplateLocked ? "cursor-not-allowed bg-slate-100 text-slate-500" : undefined)} placeholder="Variable label" value={variable.label} onChange={(event) => updateVariable(variable.id, (current) => ({ ...current, label: event.target.value }))} />
                          <div className="relative">
                            <select disabled={isTemplateLocked} className={clsx("w-full appearance-none rounded-lg border border-[#cdd5e2] bg-white px-3 py-2 text-sm", isTemplateLocked ? "cursor-not-allowed bg-slate-100 text-slate-500" : undefined)} value={variable.mode} onChange={(event) => updateVariable(variable.id, (current) => ({ ...current, mode: event.target.value as TemplateVariable["mode"], source: event.target.value === "repair_field" ? `repair.${current.repairField}` : "manual" }))}>
                              <option value="manual">Manual</option>
                              <option value="repair_field">Connect to repair</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
                          </div>
                        </div>

                        {variable.mode === "manual" ? (
                          <input readOnly={isTemplateLocked} className={clsx("mt-3 w-full rounded-lg border border-[#cdd5e2] bg-white px-3 py-2 text-sm", isTemplateLocked ? "cursor-not-allowed bg-slate-100 text-slate-500" : undefined)} placeholder="Manual default value" value={variable.manualValue} onChange={(event) => updateVariable(variable.id, (current) => ({ ...current, manualValue: event.target.value, source: "manual" }))} />
                        ) : (
                          <div className="relative mt-3">
                            <select disabled={isTemplateLocked} className={clsx("w-full appearance-none rounded-lg border border-[#cdd5e2] bg-white px-3 py-2 text-sm", isTemplateLocked ? "cursor-not-allowed bg-slate-100 text-slate-500" : undefined)} value={variable.repairField} onChange={(event) => updateVariable(variable.id, (current) => ({ ...current, repairField: event.target.value as TemplateVariable["repairField"], source: `repair.${event.target.value}` }))}>
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
                ) : null}

                {isVariablesOpen && orphanVariableIndexes.length > 0 ? <p className="mt-3 text-xs text-amber-600">Unused variables detected ({orphanVariableIndexes.map((index) => toPlaceholder(index)).join(", ")}); they will be removed during save normalization.</p> : null}
              </div>

            <div ref={buttonsSectionRef} className={clsx("rounded-xl border border-[#d7dce3] bg-white", isButtonsOpen ? "p-4" : "px-3 py-2")}>
                <button type="button" className={clsx("flex w-full items-center justify-between rounded-lg px-2 text-left transition-colors hover:bg-slate-50", isButtonsOpen ? "mb-3 min-h-10" : "min-h-8")} onClick={() => setIsButtonsOpen((prev) => !prev)}>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Buttons</h3>
                    <p className="text-xs text-slate-500">
                      {buttonMode === "QUICK_REPLY" ? `${quickReplyCount}/3 quick replies used` : buttonMode === "CTA" ? `${ctaCount}/2 CTA buttons used` : "Add quick replies or call-to-action buttons."}
                    </p>
                  </div>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d7dce3] bg-white text-slate-500">
                    {isButtonsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </button>

                {isButtonsOpen ? (
                  <div className="space-y-3">
                    {values.buttons.length === 0 ? <p className="text-xs text-slate-500">No buttons yet. Use Add Button to start with quick replies or CTA buttons.</p> : null}
                    {values.buttons.map((button, index) => (
                      <div key={button.id} className={clsx("rounded-lg border bg-[#f8fafc] p-3 transition-colors", highlightedButtonId === button.id ? "border-[#2fb2a3] ring-2 ring-[#2fb2a3]/20" : "border-[#d7dce3]")}>
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-xs font-semibold text-slate-500">{button.type === "QUICK_REPLY" ? "Quick Reply" : "CTA"}</div>
                          <button type="button" disabled={isTemplateLocked} className={clsx("text-xs font-semibold text-red-500 hover:text-red-600", isTemplateLocked ? "cursor-not-allowed opacity-40" : undefined)} onClick={() => setValues((prev) => ({ ...prev, buttons: prev.buttons.filter((item) => item.id !== button.id) }))}>Remove</button>
                        </div>
                        {button.type === "URL" || button.type === "PHONE_NUMBER" ? (
                          <div className="relative mb-3">
                            <select
                              disabled={isTemplateLocked}
                              className={clsx("w-full appearance-none rounded-lg border border-[#cdd5e2] bg-white px-3 py-2 text-sm", isTemplateLocked ? "cursor-not-allowed bg-slate-100 text-slate-500" : undefined)}
                              value={button.type}
                              onChange={(event) =>
                                updateButton(button.id, (current) =>
                                  event.target.value === "URL"
                                    ? { id: current.id, type: "URL", text: current.text, url: current.type === "URL" ? current.url : "" }
                                    : { id: current.id, type: "PHONE_NUMBER", text: current.text, phoneNumber: current.type === "PHONE_NUMBER" ? current.phoneNumber : "" }
                                )
                              }
                            >
                              <option value="URL">CTA: URL</option>
                              <option value="PHONE_NUMBER">CTA: Phone</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
                          </div>
                        ) : null}

                        <input ref={(node) => { buttonInputRefs.current[button.id] = node; }} readOnly={isTemplateLocked} className={clsx("w-full rounded-lg border border-[#cdd5e2] bg-white px-3 py-2 text-sm", isTemplateLocked ? "cursor-not-allowed bg-slate-100 text-slate-500" : undefined)} placeholder="Button text (max 20 chars)" value={button.text} maxLength={20} onChange={(event) => updateButton(button.id, (current) => ({ ...current, text: event.target.value }))} />
                        <div className="mt-1 text-xs text-slate-500">{button.text.trim().length}/20</div>
                        {emptyButtonIndexes.has(index) ? <p className="mt-1 text-xs text-red-500">Button text cannot be empty.</p> : null}
                        {tooLongButtonIndexes.has(index) ? <p className="mt-1 text-xs text-red-500">Button text cannot exceed 20 characters.</p> : null}
                        {duplicateButtonIndexes.has(index) ? <p className="mt-1 text-xs text-red-500">Duplicate button label is not allowed.</p> : null}
                        {button.type === "URL" || button.type === "PHONE_NUMBER" ? (
                          <>
                            <input
                              readOnly={isTemplateLocked}
                              className={clsx("mt-3 w-full rounded-lg border border-[#cdd5e2] bg-white px-3 py-2 text-sm", isTemplateLocked ? "cursor-not-allowed bg-slate-100 text-slate-500" : undefined)}
                              placeholder={button.type === "URL" ? "https://example.com" : "+31123456789"}
                              value={button.type === "URL" ? button.url : button.phoneNumber}
                              onChange={(event) => updateButton(button.id, (current) => current.type === "URL" ? { ...current, url: event.target.value } : { ...current, phoneNumber: event.target.value })}
                            />
                            {ctaNeedsValueIndexes.has(index) ? <p className="mt-1 text-xs text-red-500">CTA requires a URL or phone number.</p> : null}
                            {invalidUrlIndexes.has(index) ? <p className="mt-1 text-xs text-red-500">Enter a valid http(s) URL.</p> : null}
                            {invalidPhoneIndexes.has(index) ? <p className="mt-1 text-xs text-red-500">Enter a valid phone number in international format (e.g. +31612345678).</p> : null}
                          </>
                        ) : null}
                      </div>
                    ))}
                    {hasMixedButtonTypes ? <p className="text-xs text-red-500">Buttons must be either quick replies or CTA buttons. Remove one type to continue.</p> : null}
                    {quickReplyCount >= 3 ? <p className="text-xs text-amber-600">Maximum of 3 quick replies reached.</p> : null}
                    {ctaCount >= 2 ? <p className="text-xs text-amber-600">Maximum of 2 call-to-action buttons reached.</p> : null}
                    {urlCount > 1 ? <p className="text-xs text-red-500">Only one URL button is allowed.</p> : null}
                    {phoneCount > 1 ? <p className="text-xs text-red-500">Only one phone button is allowed.</p> : null}
                    {quickReplyCount > 0 ? <p className="text-xs text-slate-500">{quickReplySlotsLeft} quick reply slot(s) remaining.</p> : null}
                  </div>
                ) : null}
              </div>

            <div className="flex items-center gap-3 pt-1">
              <button type="button" className={clsx("relative inline-flex h-7 w-12 items-center rounded-full transition", values.active ? "bg-[#2fb2a3]" : "bg-slate-300")} onClick={() => setValues((prev) => ({ ...prev, active: !prev.active }))} aria-label="Toggle active">
                <span className={clsx("inline-block h-5 w-5 transform rounded-full bg-white transition", values.active ? "translate-x-6" : "translate-x-1")} />
              </button>
              <span className="text-sm text-slate-700">Active</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#e2e8f0] bg-[#f4f6fa] px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
            <button type="submit" className={clsx("rounded-xl px-5 py-2 text-sm font-semibold text-white", isValid ? "bg-[#2fb2a3] hover:bg-[#2a9f91]" : "cursor-not-allowed bg-slate-400")} disabled={!isValid}>{mode === "create" ? "Create" : "Save"}</button>
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
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Delete template</h2>
          <button type="button" onClick={onCancel} className="rounded-md p-1 text-slate-500 hover:bg-slate-200" aria-label="Close delete template dialog">
            <X className="h-5 w-5" />
          </button>
        </div>
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
    category: normalizeCategory(template.category),
    buttons: (template.buttons ?? []).map((button) => normalizeButton(button))
  })));
  const [workflowStages, setWorkflowStages] = useState<StoredWorkflowStage[]>(() => readStoredWorkflowStages(defaultWorkflowStages));
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const editingTemplate = templates.find((template) => template.id === editingTemplateId) ?? null;

  useEffect(() => {
    writeStoredTemplates(templates);
  }, [templates]);

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
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-action-menu='true']")) return;
      setOpenMenuId(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const deletingTemplate = templates.find((template) => template.id === deletingTemplateId) ?? null;
  const visibleWorkflowStages = useMemo(() => filterVisibleWorkflowStages(workflowStages), [workflowStages]);
  const toStoredLanguage = (language: string) => {
    if (language === "Dutch") return "nl";
    if (language === "English") return "en";
    return "de";
  };

  const handleCreateTemplate = (values: TemplateFormValues) => {
    const normalizedButtons = sanitizeButtonsForSave(values.buttons);
    if (hasMixedButtonModes(normalizedButtons)) return;

    const newTemplate: Template = {
      id: `tpl_${Date.now()}`,
      name: values.name.trim(),
      category: values.category,
      language: toStoredLanguage(values.language),
      body: values.body.trim(),
      active: values.active,
      variables: values.variables,
      buttons: normalizedButtons
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
          active: values.active
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
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--surface-3)] px-5 text-sm font-semibold text-[var(--text-primary)]"
            >
              <Plus className="h-4 w-4" />
              Add Template
            </button>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => {
            const linkedStages = visibleWorkflowStages.filter((stage) => stage.templateAutomationEnabled && stage.templateId === template.id);

            return (
            <article
              key={template.id}
              role="button"
              tabIndex={0}
              onClick={() => setEditingTemplateId(template.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setEditingTemplateId(template.id);
                }
              }}
              className="relative cursor-pointer rounded-2xl border border-[#253149] bg-[#121b2b]/65 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105"
            >
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold text-white">{template.name}</h2>
                <button
                  data-action-menu="true"
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-800/70"
                  aria-label={`Open actions for ${template.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpenMenuId((prev) => (prev === template.id ? null : template.id));
                  }}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

              {openMenuId === template.id ? (
                <div data-action-menu="true" className="absolute right-6 top-14 z-10 w-32 rounded-xl border border-[#d7dce3] bg-[#f4f6fa] p-1 shadow-xl">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-200"
                    onClick={(event) => {
                      event.stopPropagation();
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
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeletingTemplateId(template.id);
                      setOpenMenuId(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-slate-300">Workflow stage:</span>
                {linkedStages.length > 0 ? (
                  linkedStages.map((stage) => (
                    <Link
                      key={stage.id}
                      href={{ pathname: "/settings/advanced", query: { stageId: stage.id } }}
                      onClick={(event) => event.stopPropagation()}
                      style={{
                        color: stage.color,
                        borderColor: stage.color,
                        backgroundColor: `${stage.color}1a`
                      }}
                      className="inline-flex items-center rounded-full border px-2.5 py-1 font-semibold hover:brightness-110"
                    >
                      {stage.name}
                    </Link>
                  ))
                ) : (
                  <span className="font-medium text-slate-400">None</span>
                )}
              </div>

              <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-3">
                <div className="text-sm leading-6 text-slate-300">{renderPreviewTokens(template.body, template.variables)}</div>
                {renderPreviewButtons(template.buttons)}
              </div>
            </article>
            );
          })}
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

    </>
  );
}
