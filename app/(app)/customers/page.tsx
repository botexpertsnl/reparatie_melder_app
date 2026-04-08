"use client";

import { useEffect, useMemo, useState } from "react";
import { Cog, Languages, Clock3 } from "lucide-react";
import { getImpersonatingTenant, isSuperAdmin } from "@/lib/impersonation-store";
import { defaultTenantSettings, readTenantSettings, writeTenantSettings, type TenantSettings } from "@/lib/tenant-settings-store";

const knownTenants = ["AutoGarage De Vries", "FixIt Phone Repair"];
const retentionOptions = ["1 week", "2 weeks", "1 month", "3 months"];

export default function CustomersPage() {
  const [superAdmin, setSuperAdmin] = useState(false);
  const [tenantName, setTenantName] = useState(knownTenants[0]);
  const [values, setValues] = useState<TenantSettings>(defaultTenantSettings);

  useEffect(() => {
    const activeTenant = getImpersonatingTenant() ?? knownTenants[0];
    setSuperAdmin(isSuperAdmin());
    setTenantName(activeTenant);
    setValues(readTenantSettings(activeTenant, { ...defaultTenantSettings, businessName: activeTenant }));
  }, []);

  const tenantOptions = useMemo(() => {
    const all = new Set([...knownTenants, tenantName]);
    return [...all];
  }, [tenantName]);

  const handleTenantChange = (name: string) => {
    setTenantName(name);
    setValues(readTenantSettings(name, { ...defaultTenantSettings, businessName: name }));
  };

  const saveGeneral = () => {
    writeTenantSettings(tenantName, { ...values, businessName: values.businessName.trim() || tenantName });
  };

  const saveTerminology = () => {
    writeTenantSettings(tenantName, {
      ...values,
      repairLabel: values.repairLabel.trim() || defaultTenantSettings.repairLabel,
      assetLabel: values.assetLabel.trim() || defaultTenantSettings.assetLabel,
      customerLabel: values.customerLabel.trim() || defaultTenantSettings.customerLabel,
      identifierLabel: values.identifierLabel.trim() || defaultTenantSettings.identifierLabel
    });
  };

  const saveRetention = () => {
    writeTenantSettings(tenantName, values);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white">Tenant Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Configure your business settings, terminology, and integrations.</p>
      </div>

      {superAdmin ? (
        <div className="card flex items-center gap-3">
          <span className="text-sm text-slate-400">Tenant</span>
          <select className="rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200" value={tenantName} onChange={(event) => handleTenantChange(event.target.value)}>
            {tenantOptions.map((tenant) => <option key={tenant}>{tenant}</option>)}
          </select>
        </div>
      ) : null}

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
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Languages className="h-4 w-4" />Terminology</h2>
        <p className="mt-1 text-xs text-slate-500">Customize labels to match your industry language.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Work Item Label</label>
            <input className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200" value={values.repairLabel} onChange={(event) => setValues((prev) => ({ ...prev, repairLabel: event.target.value }))} />
            <p className="mt-1 text-[11px] text-slate-500">e.g. {values.repairLabel} / Job / Project</p>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Asset Label</label>
            <input className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200" value={values.assetLabel} onChange={(event) => setValues((prev) => ({ ...prev, assetLabel: event.target.value }))} />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Customer Label</label>
            <input className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200" value={values.customerLabel} onChange={(event) => setValues((prev) => ({ ...prev, customerLabel: event.target.value }))} />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Identifier Label</label>
            <input className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-sm text-slate-200" value={values.identifierLabel} onChange={(event) => setValues((prev) => ({ ...prev, identifierLabel: event.target.value }))} />
          </div>
        </div>
        <button type="button" onClick={saveTerminology} className="mt-4 rounded-xl bg-[#28d9c6] px-4 py-2 text-sm font-semibold text-[#022a36]">Save Terminology</button>
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
    </div>
  );
}
