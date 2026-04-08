"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, ChevronDown, MoreHorizontal, X, Pencil, Trash2 } from "lucide-react";
import clsx from "clsx";
import { defaultRepairs, readStoredRepairs, writeStoredRepairs, type StoredRepair } from "@/lib/repair-store";
import { RepairDetailsPanel } from "@/components/repairs/repair-details-panel";

type RepairItem = StoredRepair;

type NewRepairFormValues = {
  customerName: string;
  customerPhone: string;
  assetName: string;
  repairTitle: string;
  description: string;
  repairStage: RepairItem["stage"];
};

const initialFormValues: NewRepairFormValues = {
  customerName: "",
  customerPhone: "+31 ",
  assetName: "",
  repairTitle: "",
  description: "",
  repairStage: "New"
};

function StageBadge({ stage }: { stage: RepairItem["stage"] }) {
  if (stage === "Awaiting Approval") {
    return <span className="inline-flex rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-sm font-semibold text-orange-400">{stage}</span>;
  }
  if (stage === "New") {
    return <span className="inline-flex rounded-xl border border-slate-700 bg-slate-700/20 px-3 py-1 text-sm font-semibold text-slate-300">{stage}</span>;
  }
  return <span className="inline-flex rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-300">{stage}</span>;
}

function AddRepairModal({ mode, initialValues, onClose, onSubmit }: { mode: "create" | "edit"; initialValues: NewRepairFormValues; onClose: () => void; onSubmit: (payload: NewRepairFormValues) => void }) {
  const [formValues, setFormValues] = useState<NewRepairFormValues>(initialValues);
  const canSubmit = formValues.customerName.trim() && formValues.customerPhone.trim() && formValues.assetName.trim() && formValues.repairTitle.trim() && formValues.description.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="text-2xl font-semibold">{mode === "create" ? "New Repair" : "Edit Repair"}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-200" type="button" aria-label="Close repair dialog"><X className="h-5 w-5" /></button>
        </div>

        <form className="space-y-5 px-6 pb-6" onSubmit={(event) => { event.preventDefault(); if (!canSubmit) return; onSubmit(formValues); }}>
          <div>
            <label htmlFor="repair-customer-name" className="mb-2 block text-sm font-medium text-slate-700">Customer name *</label>
            <input id="repair-customer-name" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]" placeholder="e.g. John Doe" value={formValues.customerName} onChange={(event) => setFormValues((prev) => ({ ...prev, customerName: event.target.value }))} />
          </div>
          <div>
            <label htmlFor="repair-customer-phone" className="mb-2 block text-sm font-medium text-slate-700">Customer phone *</label>
            <input id="repair-customer-phone" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]" placeholder="+31 6 12345678" value={formValues.customerPhone} onChange={(event) => setFormValues((prev) => ({ ...prev, customerPhone: event.target.value }))} />
          </div>
          <div>
            <label htmlFor="repair-asset" className="mb-2 block text-sm font-medium text-slate-700">Device / asset *</label>
            <input id="repair-asset" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]" placeholder="e.g. iPhone 14 Pro" value={formValues.assetName} onChange={(event) => setFormValues((prev) => ({ ...prev, assetName: event.target.value }))} />
          </div>
          <div>
            <label htmlFor="repair-title" className="mb-2 block text-sm font-medium text-slate-700">Repair title *</label>
            <input id="repair-title" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]" placeholder="e.g. Screen replacement" value={formValues.repairTitle} onChange={(event) => setFormValues((prev) => ({ ...prev, repairTitle: event.target.value }))} />
          </div>
          <div>
            <label htmlFor="repair-description" className="mb-2 block text-sm font-medium text-slate-700">Description *</label>
            <textarea id="repair-description" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]" placeholder="Describe the issue and any diagnostics." value={formValues.description} onChange={(event) => setFormValues((prev) => ({ ...prev, description: event.target.value }))} />
          </div>

          <div>
            <label htmlFor="repair-stage" className="mb-2 block text-sm font-medium text-slate-700">Stage</label>
            <select id="repair-stage" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]" value={formValues.repairStage} onChange={(event) => setFormValues((prev) => ({ ...prev, repairStage: event.target.value as RepairItem["stage"] }))}>
              <option>New</option><option>Awaiting Approval</option><option>In Progress</option><option>Ready for Pickup</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
            <button type="submit" className={clsx("rounded-xl px-5 py-2 text-sm font-semibold text-white", canSubmit ? "bg-[#2fb2a3] hover:bg-[#2a9f91]" : "cursor-not-allowed bg-slate-400")} disabled={!canSubmit}>{mode === "create" ? "Create Repair" : "Save Repair"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WorkItemsPage() {
  const [repairs, setRepairs] = useState<RepairItem[]>(() => readStoredRepairs(defaultRepairs));
  const [isAddRepairOpen, setIsAddRepairOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingRepairId, setEditingRepairId] = useState<string | null>(null);
  const [deletingRepairId, setDeletingRepairId] = useState<string | null>(null);
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null);

  useEffect(() => {
    writeStoredRepairs(repairs);
  }, [repairs]);

  useEffect(() => {
    const handle = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-action-menu='true']")) return;
      setOpenMenuId(null);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const editingRepair = repairs.find((repair) => repair.id === editingRepairId) ?? null;
  const deletingRepair = repairs.find((repair) => repair.id === deletingRepairId) ?? null;
  const selectedRepair = useMemo(() => repairs.find((repair) => repair.id === selectedRepairId) ?? null, [repairs, selectedRepairId]);

  const handleCreateRepair = (payload: NewRepairFormValues) => {
    const newRepair = { id: `repair_${Date.now()}`, title: payload.repairTitle, description: payload.description, customerName: payload.customerName, customerPhone: payload.customerPhone, assetName: payload.assetName, stage: payload.repairStage, priority: "Medium" as const, status: "Open" as const };
    setRepairs((prev) => [newRepair, ...prev]);
    setSelectedRepairId(newRepair.id);
    setIsAddRepairOpen(false);
  };

  const handleEditRepair = (repairId: string, payload: NewRepairFormValues) => {
    setRepairs((prev) => prev.map((repair) => (repair.id === repairId ? { ...repair, title: payload.repairTitle, description: payload.description, customerName: payload.customerName, customerPhone: payload.customerPhone, assetName: payload.assetName, stage: payload.repairStage } : repair)));
    setEditingRepairId(null);
  };

  const toFormValues = (repair: RepairItem): NewRepairFormValues => ({ customerName: repair.customerName, customerPhone: repair.customerPhone, assetName: repair.assetName, repairTitle: repair.title, description: repair.description, repairStage: repair.stage });

  return (
    <>
      <div className="space-y-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-2xl font-semibold text-white">Repairs</h1><p className="mt-1 text-sm text-slate-400">Manage ongoing repairs</p></div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <button className="inline-flex h-11 min-w-40 items-center justify-between rounded-xl border border-[#253149] bg-[#0a111f] px-4 text-sm text-slate-400">All<ChevronDown className="ml-4 h-5 w-5" /></button>
            <label className="flex h-11 min-w-72 items-center gap-3 rounded-xl border border-[#253149] bg-[#0a111f] px-4 text-sm text-slate-400"><Search className="h-5 w-5" /><span className="text-sm">Search...</span></label>
            <button onClick={() => setIsAddRepairOpen(true)} className="inline-flex h-11 items-center gap-3 rounded-xl bg-[#28d9c6] px-5 text-sm font-semibold text-[#022a36]"><Plus className="h-5 w-5" />New Repair</button>
          </div>
        </div>

        <section className={`grid overflow-hidden rounded-2xl border border-[#253149] bg-[#121b2b]/65 transition-[grid-template-columns] duration-300 ${selectedRepair ? "grid-cols-[1fr_380px]" : "grid-cols-[1fr_0px]"}`}>
          <div className="min-w-0">
            <table className="w-full table-fixed">
              <thead className="border-b border-[#253149] text-left text-sm text-slate-400"><tr><th className="w-[37%] px-5 py-4">Title</th><th className="w-[24%] px-5 py-4">Customer</th><th className="w-[22%] px-5 py-4">Stage</th><th className="w-[12%] px-5 py-4">Status</th><th className="w-[5%] px-5 py-4" /></tr></thead>
              <tbody>
                {repairs.map((repair) => (
                  <tr key={repair.id} onClick={() => setSelectedRepairId(repair.id)} className={`border-b border-[#253149] last:border-b-0 ${selectedRepairId === repair.id ? "bg-[#182236]/60" : ""}`}>
                    <td className="px-5 py-4 align-middle"><button type="button" className="text-left" onClick={() => setSelectedRepairId(repair.id)}><div className="text-lg font-semibold leading-tight text-white transition-colors hover:text-[#25d3c4]">{repair.title}</div><div className="mt-1 text-sm text-slate-500">{repair.assetName} · {repair.description}</div></button></td>
                    <td className="px-5 py-4 align-middle text-lg font-semibold text-white">{repair.customerName}</td>
                    <td className="px-5 py-4 align-middle"><StageBadge stage={repair.stage} /></td>
                    <td className="px-5 py-4 align-middle"><span className="inline-flex rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-300">{repair.status}</span></td>
                    <td className="relative px-5 py-4 align-middle text-center text-slate-400">
                      <button data-action-menu="true" className="rounded-md p-1 hover:bg-slate-800/70" onClick={(event) => { event.stopPropagation(); setOpenMenuId((prev) => (prev === repair.id ? null : repair.id)); }}><MoreHorizontal className="h-5 w-5" /></button>
                      {openMenuId === repair.id ? (
                        <div data-action-menu="true" className="absolute right-7 top-12 z-10 w-32 rounded-xl border border-[#d7dce3] bg-[#f4f6fa] p-1 text-left shadow-xl">
                          <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-200" onClick={() => { setEditingRepairId(repair.id); setOpenMenuId(null); }}><Pencil className="h-4 w-4" />Edit</button>
                          <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50" onClick={() => { setDeletingRepairId(repair.id); setOpenMenuId(null); }}><Trash2 className="h-4 w-4" />Delete</button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`overflow-hidden border-l border-[#253149] bg-[#0b1221] transition-transform duration-300 ${selectedRepair ? "translate-x-0" : "translate-x-full"}`}>
            {selectedRepair ? <RepairDetailsPanel repair={selectedRepair} onClose={() => setSelectedRepairId(null)} className="h-full border-l-0 bg-transparent" /> : null}
          </div>
        </section>
      </div>

      {isAddRepairOpen ? <AddRepairModal mode="create" initialValues={initialFormValues} onClose={() => setIsAddRepairOpen(false)} onSubmit={handleCreateRepair} /> : null}
      {editingRepair ? <AddRepairModal mode="edit" initialValues={toFormValues(editingRepair)} onClose={() => setEditingRepairId(null)} onSubmit={(values) => handleEditRepair(editingRepair.id, values)} /> : null}
      {deletingRepair ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] p-6 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]"><h2 className="text-xl font-semibold">Delete repair</h2><p className="mt-2 text-sm text-slate-600">Are you sure you want to delete <span className="font-semibold">{deletingRepair.title}</span>?</p><div className="mt-6 flex items-center justify-end gap-3"><button type="button" onClick={() => setDeletingRepairId(null)} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button><button type="button" onClick={() => { setRepairs((prev) => prev.filter((repair) => repair.id !== deletingRepair.id)); if (selectedRepairId === deletingRepair.id) setSelectedRepairId(null); setDeletingRepairId(null); }} className="rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600">Delete</button></div></div></div>
      ) : null}
    </>
  );
}
