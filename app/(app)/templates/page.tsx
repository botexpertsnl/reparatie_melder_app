"use client";

import { useEffect, useState } from "react";
import { Plus, MoreHorizontal, X, ChevronDown, Pencil, Trash2 } from "lucide-react";
import clsx from "clsx";

import { defaultStoredTemplates, readStoredTemplates, writeStoredTemplates } from "@/lib/template-store";

type TemplateVariable = {
  id: string;
  name: string;
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
  spotlerId: string;
  active: boolean;
  variables: TemplateVariable[];
  buttons: TemplateButton[];
};

type TemplateFormValues = {
  name: string;
  category: string;
  language: string;
  body: string;
  spotlerId: string;
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
  spotlerId: "",
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
    spotlerId: template.spotlerId,
    active: template.active,
    variables: (template.variables ?? []).map((variable) => ({
      id: variable.id,
      name: variable.name,
      mode: variable.mode,
      manualValue: variable.manualValue ?? "",
      repairField: variable.repairField ?? "customerName"
    })),
    buttons: (template.buttons ?? []).map((button) => ({ ...button }))
  };
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
  const [values, setValues] = useState<TemplateFormValues>(initialValues);
  const [showAddButtonMenu, setShowAddButtonMenu] = useState(false);

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

  const hasButtonValidationError =
    duplicateButtonIndexes.size > 0 || emptyButtonIndexes.size > 0 || tooLongButtonIndexes.size > 0 || ctaNeedsValueIndexes.size > 0;
  const isValid = values.name.trim().length > 0 && values.body.trim().length > 0 && !hasButtonValidationError;
  const quickReplySlotsLeft = Math.max(0, 3 - quickReplyCount);

  const updateVariable = (variableId: string, updater: (variable: TemplateVariable) => TemplateVariable) => {
    setValues((prev) => ({
      ...prev,
      variables: prev.variables.map((variable) => (variable.id === variableId ? updater(variable) : variable))
    }));
  };

  const updateButton = (buttonId: string, updater: (button: TemplateButton) => TemplateButton) => {
    setValues((prev) => ({
      ...prev,
      buttons: prev.buttons.map((button) => (button.id === buttonId ? updater(button) : button))
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="text-2xl font-semibold">{mode === "create" ? "Create Template" : "Edit Template"}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-200" aria-label="Close template modal">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-5 px-6 pb-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isValid) return;
            onSubmit({
              ...values,
              name: values.name.trim(),
              body: values.body.trim(),
              spotlerId: values.spotlerId.trim(),
              variables: values.variables.map((variable) => ({
                ...variable,
                name: variable.name.trim(),
                manualValue: variable.manualValue.trim()
              })),
              buttons: values.buttons.map((button) => ({
                ...button,
                text: button.text.trim(),
                value: button.value?.trim()
              }))
            });
          }}
        >
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

          <div>
            <label htmlFor="body-preview" className="mb-2 block text-sm font-medium text-slate-700">
              Body Preview *
            </label>
            <textarea
              id="body-preview"
              className="min-h-28 w-full rounded-xl border border-[#cdd5e2] bg-white px-3 py-2 text-sm text-slate-700"
              placeholder="Hello {{1}}, your {{2}} is now ready."
              value={values.body}
              onChange={(event) => setValues((prev) => ({ ...prev, body: event.target.value }))}
            />
            <p className="mt-2 text-xs text-slate-500">{"Use {{1}}, {{2}} for variables"}</p>
          </div>

          <div>
            <label htmlFor="spotler-id" className="mb-2 block text-sm font-medium text-slate-700">
              Spotler External Template ID
            </label>
            <input
              id="spotler-id"
              className="w-full rounded-xl border border-[#cdd5e2] bg-white px-3 py-2 text-sm"
              placeholder="Leave blank to configure later"
              value={values.spotlerId}
              onChange={(event) => setValues((prev) => ({ ...prev, spotlerId: event.target.value }))}
            />
          </div>

          <div className="rounded-xl border border-[#d7dce3] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Variables</h3>
                <p className="text-xs text-slate-500">Use placeholders like {"{{1}}"} and map them to manual values or repair fields.</p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-[#2fb2a3]/40 bg-[#2fb2a3]/10 px-3 py-1.5 text-xs font-semibold text-[#1f8e82] hover:bg-[#2fb2a3]/20"
                onClick={() =>
                  setValues((prev) => ({
                    ...prev,
                    variables: [
                      ...prev.variables,
                      { id: `var_${Date.now()}`, name: `Variable ${prev.variables.length + 1}`, mode: "manual", manualValue: "", repairField: "customerName" }
                    ]
                  }))
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Add variable
              </button>
            </div>
            {values.variables.length > 0 ? (
              <div className="space-y-3">
                {values.variables.map((variable, index) => (
                  <div key={variable.id} className="rounded-lg border border-[#d7dce3] bg-[#f8fafc] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-500">Placeholder {"{{"}{index + 1}{"}}"}</div>
                      <button
                        type="button"
                        className="text-xs font-semibold text-red-500 hover:text-red-600"
                        onClick={() =>
                          setValues((prev) => ({
                            ...prev,
                            variables: prev.variables.filter((item) => item.id !== variable.id)
                          }))
                        }
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        className="w-full rounded-lg border border-[#cdd5e2] bg-white px-3 py-2 text-sm"
                        placeholder="Variable name"
                        value={variable.name}
                        onChange={(event) => updateVariable(variable.id, (current) => ({ ...current, name: event.target.value }))}
                      />
                      <div className="relative">
                        <select
                          className="w-full appearance-none rounded-lg border border-[#cdd5e2] bg-white px-3 py-2 text-sm"
                          value={variable.mode}
                          onChange={(event) =>
                            updateVariable(variable.id, (current) => ({
                              ...current,
                              mode: event.target.value as TemplateVariable["mode"],
                              repairField: current.repairField || "customerName"
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
                        onChange={(event) => updateVariable(variable.id, (current) => ({ ...current, manualValue: event.target.value }))}
                      />
                    ) : (
                      <div className="relative mt-3">
                        <select
                          className="w-full appearance-none rounded-lg border border-[#cdd5e2] bg-white px-3 py-2 text-sm"
                          value={variable.repairField}
                          onChange={(event) =>
                            updateVariable(variable.id, (current) => ({
                              ...current,
                              repairField: event.target.value as TemplateVariable["repairField"]
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
                    {(button.type === "url" || button.type === "phone") ? (
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
                    {(button.type === "url" || button.type === "phone") ? (
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
              className={clsx(
                "relative inline-flex h-7 w-12 items-center rounded-full transition",
                values.active ? "bg-[#2fb2a3]" : "bg-slate-300"
              )}
              onClick={() => setValues((prev) => ({ ...prev, active: !prev.active }))}
              aria-label="Toggle active"
            >
              <span
                className={clsx(
                  "inline-block h-5 w-5 transform rounded-full bg-white transition",
                  values.active ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
            <span className="text-sm text-slate-700">Active</span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="submit"
              className={clsx(
                "rounded-xl px-5 py-2 text-sm font-semibold text-white",
                isValid ? "bg-[#2fb2a3] hover:bg-[#2a9f91]" : "cursor-not-allowed bg-slate-400"
              )}
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
    variables: (template.variables ?? []).map((variable) => ({
      id: variable.id,
      name: variable.name,
      mode: variable.mode,
      manualValue: variable.manualValue ?? "",
      repairField: variable.repairField ?? "customerName"
    })),
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
      spotlerId: values.spotlerId.trim(),
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
          spotlerId: values.spotlerId.trim(),
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
