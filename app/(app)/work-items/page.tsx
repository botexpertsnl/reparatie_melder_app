"use client";

import { useEffect, useState } from "react";
import { Plus, Search, ChevronDown, MoreHorizontal, X, Pencil, Trash2 } from "lucide-react";

type RepairItem = {
  id: string;
  title: string;
  description: string;
  customer: string;
  stage: "Awaiting Approval" | "New" | "In Progress" | "Ready for Pickup";
  priority: "High" | "Medium" | "Low";
  status: "Open";
};

type NewRepairFormValues = {
  name: string;
  countryCode: string;
  phone: string;
  repairTitle: string;
  description: string;
  repairStage: RepairItem["stage"];
  priority: RepairItem["priority"];
};

const initialRepairs: RepairItem[] = [
  {
    id: "repair_1",
    title: "Annual service + brake inspection",
    description: "Inspect front and rear brakes during annual service",
    customer: "Jan Bakker",
    stage: "Awaiting Approval",
    priority: "Medium",
    status: "Open"
  },
  {
    id: "repair_2",
    title: "AC system not cooling",
    description: "Diagnose compressor and refrigerant pressure issues",
    customer: "Maria Smits",
    stage: "Awaiting Approval",
    priority: "High",
    status: "Open"
  },
  {
    id: "repair_3",
    title: "Tyre replacement - 4x summer tyres",
    description: "Replace all four tyres and perform wheel balancing",
    customer: "Peter van der Berg",
    stage: "New",
    priority: "Low",
    status: "Open"
  }
];

const countryCodes = [
  { label: "NL (+31)", value: "+31" },
  { label: "BE (+32)", value: "+32" },
  { label: "DE (+49)", value: "+49" },
  { label: "FR (+33)", value: "+33" }
];

const initialFormValues: NewRepairFormValues = {
  name: "",
  countryCode: "+31",
  phone: "",
  repairTitle: "",
  description: "",
  repairStage: "New",
  priority: "Medium"
};

function StageBadge({ stage }: { stage: RepairItem["stage"] }) {
  if (stage === "Awaiting Approval") {
    return (
      <span className="inline-flex items-center gap-2 rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-sm font-semibold text-orange-400">
        <span className="h-2 w-2 rounded-full bg-orange-400" />
        {stage}
      </span>
    );
  }

  if (stage === "New") {
    return (
      <span className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-700/20 px-3 py-1 text-sm font-semibold text-slate-300">
        <span className="h-2 w-2 rounded-full bg-slate-500" />
        {stage}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-300">
      <span className="h-2 w-2 rounded-full bg-blue-300" />
      {stage}
    </span>
  );
}

function AddRepairModal({
  mode,
  initialValues,
  onClose,
  onSubmit
}: {
  mode: "create" | "edit";
  initialValues: NewRepairFormValues;
  onClose: () => void;
  onSubmit: (payload: NewRepairFormValues) => void;
}) {
  const [formValues, setFormValues] = useState<NewRepairFormValues>(initialValues);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(formValues);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-[#253149] bg-[#0f1626] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between border-b border-[#253149] px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">{mode === "create" ? "New Repair" : "Edit Repair"}</h2>
            <p className="mt-1 text-sm text-slate-400">{mode === "create" ? "Create a new repair request" : "Update this repair request"}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800/70 hover:text-slate-200"
            aria-label="Close add repair dialog"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="space-y-5 px-6 py-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="customer-name" className="mb-2 block text-sm font-medium text-slate-300">
              Name
            </label>
            <input
              id="customer-name"
              className="input"
              placeholder="Customer name"
              required
              value={formValues.name}
              onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="phone" className="mb-2 block text-sm font-medium text-slate-300">
              Phone
            </label>
            <div className="grid gap-3 sm:grid-cols-[170px_1fr]">
              <select
                value={formValues.countryCode}
                className="input"
                onChange={(event) => setFormValues((prev) => ({ ...prev, countryCode: event.target.value }))}
              >
                {countryCodes.map((country) => (
                  <option key={country.value} value={country.value}>
                    {country.label}
                  </option>
                ))}
              </select>
              <input
                id="phone"
                className="input"
                placeholder="6 1234 5678"
                required
                value={formValues.phone}
                onChange={(event) => setFormValues((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
          </div>

          <div>
            <label htmlFor="repair-title" className="mb-2 block text-sm font-medium text-slate-300">
              Repair Title
            </label>
            <input
              id="repair-title"
              className="input"
              placeholder="Describe the requested repair"
              required
              value={formValues.repairTitle}
              onChange={(event) => setFormValues((prev) => ({ ...prev, repairTitle: event.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="description" className="mb-2 block text-sm font-medium text-slate-300">
              Description
            </label>
            <textarea
              id="description"
              className="input min-h-24 resize-y"
              placeholder="Additional details for this repair"
              required
              value={formValues.description}
              onChange={(event) => setFormValues((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="repair-stage" className="mb-2 block text-sm font-medium text-slate-300">
                Repair Stage
              </label>
              <select
                id="repair-stage"
                className="input"
                value={formValues.repairStage}
                onChange={(event) => setFormValues((prev) => ({ ...prev, repairStage: event.target.value as RepairItem["stage"] }))}
              >
                <option>New</option>
                <option>Awaiting Approval</option>
                <option>In Progress</option>
                <option>Ready for Pickup</option>
              </select>
            </div>
            <div>
              <label htmlFor="priority" className="mb-2 block text-sm font-medium text-slate-300">
                Priority
              </label>
              <select
                id="priority"
                className="input"
                value={formValues.priority}
                onChange={(event) => setFormValues((prev) => ({ ...prev, priority: event.target.value as RepairItem["priority"] }))}
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#253149] pt-5">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#253149] bg-[#0a111f] px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900/70">
              Cancel
            </button>
            <button type="submit" className="btn px-5 py-2">
              {mode === "create" ? "Create Repair" : "Save Repair"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WorkItemsPage() {
  const [isAddRepairOpen, setIsAddRepairOpen] = useState(false);
  const [repairs, setRepairs] = useState<RepairItem[]>(initialRepairs);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingRepairId, setEditingRepairId] = useState<string | null>(null);
  const [deletingRepairId, setDeletingRepairId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-action-menu='true']")) return;
      setOpenMenuId(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const editingRepair = repairs.find((repair) => repair.id === editingRepairId) ?? null;
  const deletingRepair = repairs.find((repair) => repair.id === deletingRepairId) ?? null;

  const handleCreateRepair = (payload: NewRepairFormValues) => {
    const newRepair: RepairItem = {
      id: `repair_${Date.now()}`,
      title: payload.repairTitle,
      description: payload.description,
      customer: payload.name,
      stage: payload.repairStage,
      priority: payload.priority,
      status: "Open"
    };

    setRepairs((prev) => [newRepair, ...prev]);
    setIsAddRepairOpen(false);
  };

  const handleEditRepair = (repairId: string, payload: NewRepairFormValues) => {
    setRepairs((prev) =>
      prev.map((repair) =>
        repair.id === repairId
          ? {
              ...repair,
              title: payload.repairTitle,
              description: payload.description,
              customer: payload.name,
              stage: payload.repairStage,
              priority: payload.priority
            }
          : repair
      )
    );
    setEditingRepairId(null);
  };

  const handleDeleteRepair = (repairId: string) => {
    setRepairs((prev) => prev.filter((repair) => repair.id !== repairId));
    setDeletingRepairId(null);
  };

  const toFormValues = (repair: RepairItem): NewRepairFormValues => ({
    name: repair.customer,
    countryCode: "+31",
    phone: "",
    repairTitle: repair.title,
    description: repair.description,
    repairStage: repair.stage,
    priority: repair.priority
  });

  return (
    <>
      <div className="space-y-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Repairs</h1>
            <p className="mt-1 text-sm text-slate-400">Manage ongoing repairs</p>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <button className="inline-flex h-11 min-w-40 items-center justify-between rounded-xl border border-[#253149] bg-[#0a111f] px-4 text-sm text-slate-400">
              All
              <ChevronDown className="ml-4 h-5 w-5" />
            </button>

            <label className="flex h-11 min-w-72 items-center gap-3 rounded-xl border border-[#253149] bg-[#0a111f] px-4 text-sm text-slate-400">
              <Search className="h-5 w-5" />
              <span className="text-sm">Search...</span>
            </label>

            <button onClick={() => setIsAddRepairOpen(true)} className="inline-flex h-11 items-center gap-3 rounded-xl bg-[#28d9c6] px-5 text-sm font-semibold text-[#022a36]">
              <Plus className="h-5 w-5" />
              New Repair
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#253149] bg-[#121b2b]/65">
          <table className="w-full table-fixed">
            <thead className="border-b border-[#253149] text-left text-sm text-slate-400">
              <tr>
                <th className="w-[37%] px-5 py-4">Title</th>
                <th className="w-[24%] px-5 py-4">Customer</th>
                <th className="w-[22%] px-5 py-4">Stage</th>
                <th className="w-[12%] px-5 py-4">Status</th>
                <th className="w-[5%] px-5 py-4" />
              </tr>
            </thead>
            <tbody>
              {repairs.map((repair) => (
                <tr key={repair.id} className="border-b border-[#253149] last:border-b-0">
                  <td className="px-5 py-4 align-middle">
                    <div className="text-lg font-semibold leading-tight text-white transition-colors hover:text-[#25d3c4]">{repair.title}</div>
                    <div className="mt-1 text-sm text-slate-500">{repair.description}</div>
                  </td>
                  <td className="px-5 py-4 align-middle text-lg font-semibold text-white">{repair.customer}</td>
                  <td className="px-5 py-4 align-middle">
                    <StageBadge stage={repair.stage} />
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <span className="inline-flex rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-300">{repair.status}</span>
                  </td>
                  <td className="relative px-5 py-4 align-middle text-center text-slate-400">
                    <button
                      data-action-menu="true"
                      className="rounded-md p-1 hover:bg-slate-800/70"
                      aria-label="Open row actions"
                      onClick={() => setOpenMenuId((prev) => (prev === repair.id ? null : repair.id))}
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>

                    {openMenuId === repair.id ? (
                      <div data-action-menu="true" className="absolute right-7 top-12 z-10 w-32 rounded-xl border border-[#d7dce3] bg-[#f4f6fa] p-1 text-left shadow-xl">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
                          onClick={() => {
                            setEditingRepairId(repair.id);
                            setOpenMenuId(null);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                          onClick={() => {
                            setDeletingRepairId(repair.id);
                            setOpenMenuId(null);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {isAddRepairOpen ? (
        <AddRepairModal
          mode="create"
          initialValues={initialFormValues}
          onClose={() => setIsAddRepairOpen(false)}
          onSubmit={handleCreateRepair}
        />
      ) : null}

      {editingRepair ? (
        <AddRepairModal
          mode="edit"
          initialValues={toFormValues(editingRepair)}
          onClose={() => setEditingRepairId(null)}
          onSubmit={(values) => handleEditRepair(editingRepair.id, values)}
        />
      ) : null}

      {deletingRepair ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] p-6 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
            <h2 className="text-xl font-semibold">Delete repair</h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete <span className="font-semibold">{deletingRepair.title}</span>?
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setDeletingRepairId(null)} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                Cancel
              </button>
              <button type="button" onClick={() => handleDeleteRepair(deletingRepair.id)} className="rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600">
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
