"use client";

import { FormEvent, useState } from "react";
import { useDemoStore } from "@/lib/demo-store";

export default function TemplatesPage() {
  const { templates, isReady } = useDemoStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", category: "update", language: "en" });

  if (!isReady) return <div className="card">Loading demo data...</div>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    if (editingId) templates.update((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...form } : t)));
    else templates.update((prev) => [...prev, { id: `tpl_${Date.now()}`, ...form }]);
    setEditingId(null);
    setForm({ name: "", category: "update", language: "en" });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Templates</h1>
      <form onSubmit={submit} className="card grid gap-2 md:grid-cols-4">
        <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        <input className="input" placeholder="Category" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
        <input className="input" placeholder="Language" value={form.language} onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))} />
        <button className="btn">{editingId ? "Save" : "Add"}</button>
      </form>

      <div className="card space-y-2">
        {templates.value.map((template) => (
          <div key={template.id} className="flex items-center justify-between rounded-md border border-slate-800 p-3 text-sm">
            <span>{template.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">{template.category} · {template.language}</span>
              <button className="badge" onClick={() => { setEditingId(template.id); setForm(template); }}>Edit</button>
              <button className="badge" onClick={() => templates.update((prev) => prev.filter((t) => t.id !== template.id))}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
