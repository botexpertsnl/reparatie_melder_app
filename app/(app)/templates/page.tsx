"use client";

import { useState } from "react";
import { Plus, MoreHorizontal, X, ChevronDown } from "lucide-react";
import clsx from "clsx";

type Template = {
  id: string;
  name: string;
  category: string;
  language: string;
  body: string;
  spotlerId: string;
  active: boolean;
};

type TemplateFormValues = {
  name: string;
  category: string;
  language: string;
  body: string;
  spotlerId: string;
  active: boolean;
};

const initialTemplates: Template[] = [
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

const emptyTemplateForm: TemplateFormValues = {
  name: "",
  category: "General",
  language: "Dutch",
  body: "",
  spotlerId: "",
  active: true
};

function categoryBadgeClass(category: string) {
  if (category.toLowerCase() === "pickup") {
    return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
  }

  if (category.toLowerCase() === "update") {
    return "border-blue-500/40 bg-blue-500/10 text-blue-300";
  }

  return "border-slate-600 bg-slate-700/30 text-slate-300";
}

function TemplateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (values: TemplateFormValues) => void }) {
  const [values, setValues] = useState<TemplateFormValues>(emptyTemplateForm);
  const isValid = values.name.trim().length > 0 && values.body.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="text-2xl font-semibold">Create Template</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-200" aria-label="Close template modal">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-5 px-6 pb-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isValid) return;
            onCreate(values);
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
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleCreateTemplate = (values: TemplateFormValues) => {
    const newTemplate: Template = {
      id: `tpl_${Date.now()}`,
      name: values.name.trim(),
      category: values.category,
      language: values.language === "Dutch" ? "nl" : values.language.toLowerCase(),
      body: values.body.trim(),
      spotlerId: values.spotlerId.trim(),
      active: values.active
    };

    setTemplates((prev) => [newTemplate, ...prev]);
    setIsCreateModalOpen(false);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Templates</h1>
            <p className="mt-1 text-sm text-slate-400">Manage WhatsApp message templates</p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#28d9c6] px-5 text-sm font-semibold text-[#022a36]"
          >
            <Plus className="h-4 w-4" />
            Add Template
          </button>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <article key={template.id} className="rounded-2xl border border-[#253149] bg-[#121b2b]/65 p-5">
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold text-white">{template.name}</h2>
                <button className="rounded-md p-1 text-slate-400 hover:bg-slate-800/70" aria-label={`Open actions for ${template.name}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

              <div className={clsx("mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", categoryBadgeClass(template.category))}>{template.category}</div>

              <p className="mt-3 text-sm leading-7 text-slate-400">{template.body}</p>

              <div className="mt-3 text-sm text-slate-500">Lang: {template.language}</div>
            </article>
          ))}
        </section>
      </div>

      {isCreateModalOpen ? <TemplateModal onClose={() => setIsCreateModalOpen(false)} onCreate={handleCreateTemplate} /> : null}
    </>
  );
}
