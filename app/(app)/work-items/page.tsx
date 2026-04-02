"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useDemoStore } from "@/lib/demo-store";

const stages = ["New", "Scheduled", "In progress", "Waiting for customer approval", "Ready for pickup", "Completed"];

export default function WorkItemsPage() {
  const { workItems, customers, assets, isReady } = useDemoStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", customerId: "", assetId: "", stage: stages[0], priority: "Normal" });

  if (!isReady) return <div className="card">Loading demo data...</div>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.customerId || !form.assetId) return;
    if (editingId) workItems.update((prev) => prev.map((w) => (w.id === editingId ? { ...w, ...form } : w)));
    else workItems.update((prev) => [...prev, { id: `wi_${Date.now()}`, ...form }]);
    setEditingId(null);
    setForm({ title: "", customerId: "", assetId: "", stage: stages[0], priority: "Normal" });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Work Items</h1>
      <form onSubmit={submit} className="card grid gap-2 md:grid-cols-6">
        <input className="input" placeholder="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
        <select className="input" value={form.customerId} onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}><option value="">Customer</option>{customers.value.map((c) => <option value={c.id} key={c.id}>{c.fullName}</option>)}</select>
        <select className="input" value={form.assetId} onChange={(e) => setForm((p) => ({ ...p, assetId: e.target.value }))}><option value="">Asset</option>{assets.value.map((a) => <option value={a.id} key={a.id}>{a.displayName}</option>)}</select>
        <select className="input" value={form.stage} onChange={(e) => setForm((p) => ({ ...p, stage: e.target.value }))}>{stages.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="input" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}><option>Normal</option><option>High</option></select>
        <button className="btn">{editingId ? "Save" : "Add"}</button>
      </form>

      <div className="space-y-3">
        {workItems.value.map((item) => (
          <div key={item.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">{item.title}</div>
              <div className="text-xs text-slate-400">Stage: {item.stage} · Priority: {item.priority}</div>
            </div>
            <div className="flex gap-2">
              <button className="badge" onClick={() => { setEditingId(item.id); setForm(item); }}>Edit</button>
              <button className="badge" onClick={() => workItems.update((prev) => prev.filter((w) => w.id !== item.id))}>Delete</button>
              <Link className="btn" href={`/work-items/${item.id}`}>View</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
