"use client";

import { FormEvent, useState } from "react";
import { useDemoStore } from "@/lib/demo-store";

export default function CustomersPage() {
  const { customers, isReady } = useDemoStore();
  const [form, setForm] = useState({ fullName: "", phone: "", email: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!isReady) return <div className="card">Loading demo data...</div>;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) return;

    if (editingId) {
      customers.update((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...form } : c)));
      setEditingId(null);
    } else {
      customers.update((prev) => [...prev, { id: `cus_${Date.now()}`, ...form }]);
    }

    setForm({ fullName: "", phone: "", email: "" });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <form onSubmit={onSubmit} className="card grid gap-2 md:grid-cols-4">
        <input className="input" placeholder="Full name" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
        <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
        <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
        <button className="btn" type="submit">{editingId ? "Save" : "Add"}</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-400"><tr><th className="py-2 text-left">Name</th><th className="py-2 text-left">Phone</th><th className="py-2 text-left">Email</th><th /></tr></thead>
          <tbody>
            {customers.value.map((customer) => (
              <tr key={customer.id} className="border-t border-slate-800">
                <td className="py-2">{customer.fullName}</td><td>{customer.phone}</td><td>{customer.email}</td>
                <td className="py-2 text-right">
                  <button className="badge mr-2" onClick={() => { setEditingId(customer.id); setForm(customer); }}>Edit</button>
                  <button className="badge" onClick={() => customers.update((prev) => prev.filter((c) => c.id !== customer.id))}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
