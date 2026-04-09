"use client";

import { useEffect, useState } from "react";
import { Cog, Clock3, Users } from "lucide-react";
import { getImpersonatingTenant } from "@/lib/impersonation-store";
import { defaultTenantSettings, readTenantSettings, writeTenantSettings, type TenantSettings } from "@/lib/tenant-settings-store";
import { readTenantUsers, type TenantUser, writeTenantUsers } from "@/lib/tenant-users-store";

const knownTenants = ["AutoGarage De Vries", "FixIt Phone Repair"];
const retentionOptions = ["1 week", "2 weeks", "1 month", "3 months"];

export default function CustomersPage() {
  const [tenantName, setTenantName] = useState(knownTenants[0]);
  const [values, setValues] = useState<TenantSettings>(defaultTenantSettings);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const activeTenant = getImpersonatingTenant() ?? knownTenants[0];
    setTenantName(activeTenant);
    setValues(readTenantSettings(activeTenant, { ...defaultTenantSettings, businessName: activeTenant }));
    setUsers(readTenantUsers(activeTenant));
  }, []);

  const saveGeneral = () => {
    writeTenantSettings(tenantName, { ...values, businessName: values.businessName.trim() || tenantName });
  };

  const saveRetention = () => {
    writeTenantSettings(tenantName, values);
  };

  const resetUserForm = () => {
    setEditingUserId(null);
    setUserName("");
    setUserEmail("");
  };

  const submitUser = () => {
    const trimmedName = userName.trim();
    const trimmedEmail = userEmail.trim();
    if (!trimmedName || !trimmedEmail) return;

    const updatedUsers = editingUserId
      ? users.map((user) => (user.id === editingUserId ? { ...user, name: trimmedName, email: trimmedEmail } : user))
      : [...users, { id: `u_${Date.now()}`, name: trimmedName, email: trimmedEmail }];

    setUsers(updatedUsers);
    writeTenantUsers(tenantName, updatedUsers);
    resetUserForm();
  };

  const startEditUser = (user: TenantUser) => {
    setEditingUserId(user.id);
    setUserName(user.name);
    setUserEmail(user.email);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Configure your business settings, terminology, and integrations.</p>
      </div>

      <section className="card">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Cog className="h-4 w-4" />General</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Business Name</label>
            <input className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200" value={values.businessName} onChange={(event) => setValues((prev) => ({ ...prev, businessName: event.target.value }))} />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Timezone</label>
            <select className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200" value={values.timezone} onChange={(event) => setValues((prev) => ({ ...prev, timezone: event.target.value }))}>
              <option>Europe/Amsterdam</option>
              <option>Europe/Brussels</option>
              <option>UTC</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Locale</label>
            <select className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200" value={values.locale} onChange={(event) => setValues((prev) => ({ ...prev, locale: event.target.value }))}>
              <option>Dutch (NL)</option>
              <option>English (US)</option>
            </select>
          </div>
        </div>
        <button type="button" onClick={saveGeneral} className="mt-4 rounded-xl bg-[#28d9c6] px-4 py-2 text-sm font-semibold text-[#022a36]">Save General Settings</button>
      </section>

      <section className="card">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Clock3 className="h-4 w-4" />Customer Retention</h2>
        <p className="mt-1 text-xs text-slate-500">How long to keep customers based on their last message activity.</p>
        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Retention Period</label>
            <select className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200" value={values.retentionPeriod} onChange={(event) => setValues((prev) => ({ ...prev, retentionPeriod: event.target.value }))}>
              {retentionOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          <button type="button" onClick={saveRetention} className="rounded-xl bg-[#28d9c6] px-4 py-2 text-sm font-semibold text-[#022a36]">Save</button>
        </div>
      </section>

      <section className="card">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Users className="h-4 w-4" />Users</h2>
        <p className="mt-1 text-xs text-slate-500">Current users for this tenant. Add users or edit their registered name and e-mail.</p>

        <div className="mt-4 space-y-2">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between rounded-xl border border-[#253149] bg-[#0b1323] px-3 py-2">
              <div>
                <div className="font-medium text-white">{user.name}</div>
                <div className="text-sm text-slate-400">{user.email}</div>
              </div>
              <button type="button" onClick={() => startEditUser(user)} className="rounded-lg border border-[#253149] px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-[#152036]">
                Edit
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</label>
            <input className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200" value={userName} onChange={(event) => setUserName(event.target.value)} />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">E-mail</label>
            <input type="email" className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200" value={userEmail} onChange={(event) => setUserEmail(event.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={submitUser} disabled={!userName.trim() || !userEmail.trim()} className="rounded-xl bg-[#28d9c6] px-4 py-2 text-sm font-semibold text-[#022a36] disabled:cursor-not-allowed disabled:opacity-60">
            {editingUserId ? "Save User" : "Add User"}
          </button>
          {editingUserId ? (
            <button type="button" onClick={resetUserForm} className="rounded-xl border border-[#253149] px-4 py-2 text-sm font-semibold text-slate-200">
              Cancel
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
