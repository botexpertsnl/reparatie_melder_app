"use client";

import { FormEvent, useState } from "react";
import { useDemoStore } from "@/lib/demo-store";

export default function AssetsPage() {
  const { assets, customers, isReady } = useDemoStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ customerId: "", type: "Car", displayName: "", identifier: "" });

  if (!isReady) return <div className="card">Loading demo data...</div>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.displayName || !form.customerId) return;
    if (editingId) assets.update((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...form } : a)));
    else assets.update((prev) => [...prev, { id: `asset_${Date.now()}`, ...form }]);
    setEditingId(null);
    setForm({ customerId: "", type: "Car", displayName: "", identifier: "" });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Assets</h1>
      <form onSubmit={submit} className="card grid gap-2 md:grid-cols-5">
        <select className="input" value={form.customerId} onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}>
          <option value="">Select customer</option>
          {customers.value.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
        </select>
        <input className="input" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} placeholder="Type" />
        <input className="input" value={form.displayName} onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))} placeholder="Display name" />
        <input className="input" value={form.identifier} onChange={(e) => setForm((p) => ({ ...p, identifier: e.target.value }))} placeholder="Identifier" />
        <button className="btn">{editingId ? "Save" : "Add"}</button>
      </form>

      <div className="grid gap-3 md:grid-cols-3">
        {assets.value.map((asset) => (
          <article key={asset.id} className="card">
            <div className="text-xs text-slate-400">{asset.type}</div>
            <div className="mt-1 font-medium">{asset.displayName}</div>
            <div className="mt-1 text-sm text-slate-300">{asset.identifier}</div>
            <div className="mt-3 flex gap-2">
              <button className="badge" onClick={() => { setEditingId(asset.id); setForm(asset); }}>Edit</button>
              <button className="badge" onClick={() => assets.update((prev) => prev.filter((a) => a.id !== asset.id))}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
