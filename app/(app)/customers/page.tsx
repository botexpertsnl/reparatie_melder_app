"use client";

import { useEffect, useState } from "react";
import { Cog, Clock3, Users, Plus, X } from "lucide-react";
import { getImpersonatingTenant } from "@/lib/impersonation-store";
import { defaultTenantSettings, readTenantSettings, writeTenantSettings, type TenantSettings } from "@/lib/tenant-settings-store";
import { readTenantUsers, type TenantUser, writeTenantUsers } from "@/lib/tenant-users-store";
import { WhatsappZernioCard } from "@/components/settings/whatsapp-zernio-card";
import { BusinessHoursCard } from "@/components/settings/business-hours-card";

const knownTenants = ["AutoGarage De Vries", "FixIt Phone Repair"];
const retentionOptions = ["1 week", "2 weeks", "1 month", "3 months"];

export default function CustomersPage() {
  const [tenantName, setTenantName] = useState(knownTenants[0]);
  const [values, setValues] = useState<TenantSettings>(defaultTenantSettings);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

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

  const saveBusinessHours = () => {
    writeTenantSettings(tenantName, values);
  };

  const resetUserForm = () => {
    setEditingUserId(null);
    setUserName("");
    setUserEmail("");
    setIsUserModalOpen(false);
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

  const startAddUser = () => {
    setEditingUserId(null);
    setUserName("");
    setUserEmail("");
    setIsUserModalOpen(true);
  };

  const startEditUser = (user: TenantUser) => {
    setEditingUserId(user.id);
    setUserName(user.name);
    setUserEmail(user.email);
    setIsUserModalOpen(true);
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

      <BusinessHoursCard
        value={values.businessHours}
        onChange={(businessHours) => setValues((prev) => ({ ...prev, businessHours }))}
        onSave={saveBusinessHours}
      />

      <WhatsappZernioCard />

      <section className="card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Users className="h-4 w-4" />Users</h2>
          <button type="button" onClick={startAddUser} className="inline-flex items-center gap-1 rounded-xl bg-[#28d9c6] px-3 py-1.5 text-xs font-semibold text-[#022a36]">
            <Plus className="h-3.5 w-3.5" />
            Add User
          </button>
        </div>
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
      </section>

      {isUserModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#02050d]/80 px-4 py-6 backdrop-blur-sm sm:items-center sm:py-8">
          <div className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-5">
              <h2 className="text-2xl font-semibold">{editingUserId ? "Edit User" : "Add User"}</h2>
              <button type="button" onClick={resetUserForm} className="rounded-md p-1 text-slate-500 hover:bg-slate-200" aria-label="Close user modal">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
                  <input className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#30b5a5]" value={userName} onChange={(event) => setUserName(event.target.value)} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">E-mail</label>
                  <input type="email" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#30b5a5]" value={userEmail} onChange={(event) => setUserEmail(event.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#e2e8f0] px-6 py-4">
              <button type="button" onClick={resetUserForm} className="rounded-xl border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                Cancel
              </button>
              <button type="button" onClick={submitUser} disabled={!userName.trim() || !userEmail.trim()} className="rounded-xl bg-[#28d9c6] px-4 py-2 text-sm font-semibold text-[#022a36] disabled:cursor-not-allowed disabled:opacity-60">
                {editingUserId ? "Save User" : "Add User"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
