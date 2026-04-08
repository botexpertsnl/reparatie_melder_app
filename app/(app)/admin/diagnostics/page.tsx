"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, X } from "lucide-react";
import clsx from "clsx";
import { setSuperAdmin, startImpersonation, stopImpersonation } from "@/lib/impersonation-store";
import { defaultTenantSettings, readTenantSettings, writeTenantSettings } from "@/lib/tenant-settings-store";

type TenantUser = { id: string; name: string; email: string; role: "Owner" | "Manager" | "Operator" };
type Tenant = {
  id: string;
  name: string;
  users: TenantUser[];
  monthlyCredits: number;
  oneTimeCredits: number;
};

const initialTenants: Tenant[] = [
  {
    id: "ten_1",
    name: "AutoGarage De Vries",
    users: [
      { id: "u_1", name: "Sven de Vries", email: "sven@devries.nl", role: "Owner" },
      { id: "u_2", name: "Nina Bakker", email: "nina@devries.nl", role: "Manager" }
    ],
    monthlyCredits: 1500,
    oneTimeCredits: 240
  },
  {
    id: "ten_2",
    name: "FixIt Phone Repair",
    users: [{ id: "u_3", name: "Rik Jansen", email: "rik@fixit.nl", role: "Owner" }],
    monthlyCredits: 900,
    oneTimeCredits: 0
  }
];

function AdminModalShell({
  title,
  children,
  onClose
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="text-2xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-200" aria-label="Close dialog">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}

export default function DiagnosticsPage() {
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(initialTenants[0].id);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [userModal, setUserModal] = useState<{ mode: "create" | "edit"; userId?: string } | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [creditsModalType, setCreditsModalType] = useState<"monthly" | "one-time" | null>(null);
  const [creditsAmount, setCreditsAmount] = useState("");
  const [terminology, setTerminology] = useState({
    repairLabel: defaultTenantSettings.repairLabel,
    assetLabel: defaultTenantSettings.assetLabel,
    customerLabel: defaultTenantSettings.customerLabel,
    identifierLabel: defaultTenantSettings.identifierLabel
  });

  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId) ?? tenants[0];

  useEffect(() => {
    const settings = readTenantSettings(selectedTenant.name, { ...defaultTenantSettings, businessName: selectedTenant.name });
    setTerminology({
      repairLabel: settings.repairLabel,
      assetLabel: settings.assetLabel,
      customerLabel: settings.customerLabel,
      identifierLabel: settings.identifierLabel
    });
  }, [selectedTenant.name]);

  useEffect(() => {
    setSuperAdmin(true);
    stopImpersonation();
  }, []);

  const addUser = (name: string, email: string) => {
    setTenants((prev) =>
      prev.map((tenant) =>
        tenant.id === selectedTenant.id
          ? {
              ...tenant,
              users: [...tenant.users, { id: `u_${Date.now()}`, name, email, role: "Operator" }]
            }
          : tenant
      )
    );
  };

  const editUser = (userId: string, name: string, email: string) => {
    setTenants((prev) =>
      prev.map((tenant) =>
        tenant.id === selectedTenant.id
          ? {
              ...tenant,
              users: tenant.users.map((item) => (item.id === userId ? { ...item, name, email } : item))
            }
          : tenant
      )
    );
  };

  const addCredits = (type: "monthly" | "one-time", amount: number) => {
    if (!amount || Number.isNaN(amount)) return;

    setTenants((prev) =>
      prev.map((tenant) =>
        tenant.id === selectedTenant.id
          ? {
              ...tenant,
              monthlyCredits: type === "monthly" ? tenant.monthlyCredits + amount : tenant.monthlyCredits,
              oneTimeCredits: type === "one-time" ? tenant.oneTimeCredits + amount : tenant.oneTimeCredits
            }
          : tenant
      )
    );
  };

  const impersonateTenant = () => {
    startImpersonation(selectedTenant.name);
    window.location.href = "/dashboard";
  };

  const saveTerminology = () => {
    const current = readTenantSettings(selectedTenant.name, { ...defaultTenantSettings, businessName: selectedTenant.name });
    writeTenantSettings(selectedTenant.name, {
      ...current,
      repairLabel: terminology.repairLabel.trim() || defaultTenantSettings.repairLabel,
      assetLabel: terminology.assetLabel.trim() || defaultTenantSettings.assetLabel,
      customerLabel: terminology.customerLabel.trim() || defaultTenantSettings.customerLabel,
      identifierLabel: terminology.identifierLabel.trim() || defaultTenantSettings.identifierLabel
    });
  };

  const openCreateUserModal = () => {
    setUserName("");
    setUserEmail("");
    setUserModal({ mode: "create" });
  };

  const openEditUserModal = (userId: string) => {
    const user = selectedTenant.users.find((item) => item.id === userId);
    if (!user) return;
    setUserName(user.name);
    setUserEmail(user.email);
    setUserModal({ mode: "edit", userId });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">System Admin</h1>
        <p className="mt-1 text-sm text-slate-400">Manage tenants, users and template credits.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <aside className="card space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-500">Customers</h2>
            <button type="button" onClick={() => { setNewCustomerName(""); setShowAddCustomerModal(true); }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#28d9c6]/50 bg-[#28d9c6]/10 text-[#69f0df] hover:bg-[#28d9c6]/20" aria-label="Add customer">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {tenants.map((tenant) => (
            <button
              key={tenant.id}
              type="button"
              onClick={() => setSelectedTenantId(tenant.id)}
              className={`w-full rounded-xl border p-3 text-left ${selectedTenant.id === tenant.id ? "border-[#28d9c6]/50 bg-[#182236]" : "border-[#253149] bg-[#0b1323]"}`}
            >
              <div className="font-semibold text-white">{tenant.name}</div>
              <div className="mt-1 text-sm text-slate-400">{tenant.users.length} users attached</div>
            </button>
          ))}
        </aside>

        <section className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{selectedTenant.name}</h2>
                <p className="text-sm text-slate-400">Attached users and credit controls</p>
              </div>
              <button type="button" onClick={openCreateUserModal} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#28d9c6] px-4 text-sm font-semibold text-[#022a36]">
                <Plus className="h-4 w-4" />
                Add User
              </button>
            </div>

            <button type="button" onClick={impersonateTenant} className="mt-3 rounded-xl border border-[#28d9c6]/60 bg-[#28d9c6]/10 px-4 py-2 text-sm font-semibold text-[#7ff5e9]">
              Impersonate customer account
            </button>

            <div className="mt-4 space-y-2">
              {selectedTenant.users.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-xl border border-[#253149] bg-[#0b1323] px-3 py-2">
                  <div>
                    <div className="font-medium text-white">{user.name}</div>
                    <div className="text-sm text-slate-400">{user.email} · {user.role}</div>
                  </div>
                  <button type="button" onClick={() => openEditUserModal(user.id)} className="rounded-md p-1 text-slate-300 hover:bg-slate-800/70" aria-label={`Edit ${user.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="card">
              <div className="text-sm text-slate-400">Monthly renewing credits</div>
              <div className="mt-2 text-2xl font-semibold text-white">{selectedTenant.monthlyCredits}</div>
              <button type="button" onClick={() => { setCreditsAmount(""); setCreditsModalType("monthly"); }} className="mt-4 rounded-xl bg-[#28d9c6] px-4 py-2 text-sm font-semibold text-[#022a36]">
                Add monthly credits
              </button>
            </div>

            <div className="card">
              <div className="text-sm text-slate-400">One-time refill credits</div>
              <div className="mt-2 text-2xl font-semibold text-white">{selectedTenant.oneTimeCredits}</div>
              <button type="button" onClick={() => { setCreditsAmount(""); setCreditsModalType("one-time"); }} className="mt-4 rounded-xl bg-[#28d9c6] px-4 py-2 text-sm font-semibold text-[#022a36]">
                Add one-time credits
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-500">Terminology</h3>
            <p className="mt-1 text-sm text-slate-400">Set customer-specific labels managed by system admin.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Work Item Label</label>
                <input className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#30b5a5]" value={terminology.repairLabel} onChange={(event) => setTerminology((prev) => ({ ...prev, repairLabel: event.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Asset Label</label>
                <input className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#30b5a5]" value={terminology.assetLabel} onChange={(event) => setTerminology((prev) => ({ ...prev, assetLabel: event.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Customer Label</label>
                <input className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#30b5a5]" value={terminology.customerLabel} onChange={(event) => setTerminology((prev) => ({ ...prev, customerLabel: event.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Identifier Label</label>
                <input className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#30b5a5]" value={terminology.identifierLabel} onChange={(event) => setTerminology((prev) => ({ ...prev, identifierLabel: event.target.value }))} />
              </div>
            </div>
            <button type="button" onClick={saveTerminology} className="mt-4 rounded-xl bg-[#28d9c6] px-4 py-2 text-sm font-semibold text-[#022a36]">
              Save Terminology
            </button>
          </div>
        </section>
      </div>

      {showAddCustomerModal ? (
        <AdminModalShell title="Add Customer" onClose={() => setShowAddCustomerModal(false)}>
          <div>
            <label htmlFor="customer-name" className="mb-2 block text-sm font-medium text-slate-700">Customer name *</label>
            <input id="customer-name" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#30b5a5]" placeholder="e.g. QuickFix Amsterdam" value={newCustomerName} onChange={(event) => setNewCustomerName(event.target.value)} />
          </div>
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setShowAddCustomerModal(false)} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
            <button
              type="button"
              onClick={() => {
                const name = newCustomerName.trim();
                if (!name) return;
                const newTenant = { id: `ten_${Date.now()}`, name, users: [], monthlyCredits: 0, oneTimeCredits: 0 };
                setTenants((prev) => [...prev, newTenant]);
                setSelectedTenantId(newTenant.id);
                setShowAddCustomerModal(false);
              }}
              className={clsx("rounded-xl px-5 py-2 text-sm font-semibold text-white", newCustomerName.trim() ? "bg-[#2fb2a3] hover:bg-[#2a9f91]" : "cursor-not-allowed bg-slate-400")}
              disabled={!newCustomerName.trim()}
            >
              Add Customer
            </button>
          </div>
        </AdminModalShell>
      ) : null}

      {userModal ? (
        <AdminModalShell title={userModal.mode === "create" ? "Add User" : "Edit User"} onClose={() => setUserModal(null)}>
          <div>
            <label htmlFor="user-name" className="mb-2 block text-sm font-medium text-slate-700">User name *</label>
            <input id="user-name" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#30b5a5]" value={userName} onChange={(event) => setUserName(event.target.value)} />
          </div>
          <div>
            <label htmlFor="user-email" className="mb-2 block text-sm font-medium text-slate-700">User email *</label>
            <input id="user-email" type="email" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#30b5a5]" value={userEmail} onChange={(event) => setUserEmail(event.target.value)} />
          </div>
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setUserModal(null)} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
            <button
              type="button"
              onClick={() => {
                const name = userName.trim();
                const email = userEmail.trim();
                if (!name || !email) return;
                if (userModal.mode === "create") {
                  addUser(name, email);
                } else if (userModal.userId) {
                  editUser(userModal.userId, name, email);
                }
                setUserModal(null);
              }}
              className={clsx("rounded-xl px-5 py-2 text-sm font-semibold text-white", userName.trim() && userEmail.trim() ? "bg-[#2fb2a3] hover:bg-[#2a9f91]" : "cursor-not-allowed bg-slate-400")}
              disabled={!userName.trim() || !userEmail.trim()}
            >
              {userModal.mode === "create" ? "Add User" : "Save User"}
            </button>
          </div>
        </AdminModalShell>
      ) : null}

      {creditsModalType ? (
        <AdminModalShell title={creditsModalType === "monthly" ? "Add Monthly Credits" : "Add One-time Credits"} onClose={() => setCreditsModalType(null)}>
          <div>
            <label htmlFor="credit-amount" className="mb-2 block text-sm font-medium text-slate-700">Credits amount *</label>
            <input id="credit-amount" type="number" min={1} className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#30b5a5]" value={creditsAmount} onChange={(event) => setCreditsAmount(event.target.value)} />
          </div>
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setCreditsModalType(null)} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
            <button
              type="button"
              onClick={() => {
                const parsed = Number(creditsAmount);
                if (!parsed || Number.isNaN(parsed)) return;
                addCredits(creditsModalType, parsed);
                setCreditsModalType(null);
              }}
              className={clsx("rounded-xl px-5 py-2 text-sm font-semibold text-white", Number(creditsAmount) > 0 ? "bg-[#2fb2a3] hover:bg-[#2a9f91]" : "cursor-not-allowed bg-slate-400")}
              disabled={!(Number(creditsAmount) > 0)}
            >
              Add Credits
            </button>
          </div>
        </AdminModalShell>
      ) : null}
    </div>
  );
}
