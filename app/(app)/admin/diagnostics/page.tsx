"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";

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

export default function DiagnosticsPage() {
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(initialTenants[0].id);

  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId) ?? tenants[0];

  const addUser = () => {
    const name = window.prompt("User name");
    if (!name) return;
    const email = window.prompt("User email");
    if (!email) return;

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

  const editUser = (userId: string) => {
    const user = selectedTenant.users.find((item) => item.id === userId);
    if (!user) return;

    const name = window.prompt("Edit user name", user.name);
    if (!name) return;

    setTenants((prev) =>
      prev.map((tenant) =>
        tenant.id === selectedTenant.id
          ? {
              ...tenant,
              users: tenant.users.map((item) => (item.id === userId ? { ...item, name } : item))
            }
          : tenant
      )
    );
  };

  const addCredits = (type: "monthly" | "one-time") => {
    const amount = Number(window.prompt(type === "monthly" ? "Add monthly renewing credits" : "Add one-time refill credits"));
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">System Admin</h1>
        <p className="mt-1 text-sm text-slate-400">Manage tenants, users and template credits.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <aside className="card space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-500">Customers</h2>
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
              <button type="button" onClick={addUser} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#28d9c6] px-4 text-sm font-semibold text-[#022a36]">
                <Plus className="h-4 w-4" />
                Add User
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {selectedTenant.users.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-xl border border-[#253149] bg-[#0b1323] px-3 py-2">
                  <div>
                    <div className="font-medium text-white">{user.name}</div>
                    <div className="text-sm text-slate-400">{user.email} · {user.role}</div>
                  </div>
                  <button type="button" onClick={() => editUser(user.id)} className="rounded-md p-1 text-slate-300 hover:bg-slate-800/70" aria-label={`Edit ${user.name}`}>
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
              <button type="button" onClick={() => addCredits("monthly")} className="mt-4 rounded-xl bg-[#28d9c6] px-4 py-2 text-sm font-semibold text-[#022a36]">
                Add monthly credits
              </button>
            </div>

            <div className="card">
              <div className="text-sm text-slate-400">One-time refill credits</div>
              <div className="mt-2 text-2xl font-semibold text-white">{selectedTenant.oneTimeCredits}</div>
              <button type="button" onClick={() => addCredits("one-time")} className="mt-4 rounded-xl bg-[#28d9c6] px-4 py-2 text-sm font-semibold text-[#022a36]">
                Add one-time credits
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
