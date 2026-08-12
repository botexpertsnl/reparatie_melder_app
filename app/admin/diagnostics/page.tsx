"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, LogIn, Plus, RefreshCw, Save, Trash2, Unplug, Users } from "lucide-react";
import { startImpersonation } from "@/lib/impersonation-store";

type User = { id: string; name: string; email: string; role: "TENANT_OWNER" | "TENANT_ADMIN" | "EMPLOYEE"; isActive: boolean };
type Settings = { businessLabel: string; workItemLabel: string; assetLabel: string; customerLabel: string } | null;
type Channel = { zernioProfileId?: string | null; zernioAccountId?: string | null; whatsappPhoneNumber?: string | null; connectionStatus?: string | null } | null;
type Tenant = { id: string; name: string; industryType: string; users: User[]; settings: Settings; channels: Channel[] };
type Profile = { _id: string; name: string };
type Tab = "general" | "users" | "zernio" | "settings";

const inputClass = "mt-1.5 w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#28d9c6]";

export default function DiagnosticsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState<Tab>("general");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [profileId, setProfileId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "TENANT_ADMIN" as User["role"] });

  const selected = useMemo(() => tenants.find((tenant) => tenant.id === selectedId) ?? null, [tenants, selectedId]);
  const channel = selected?.channels[0] ?? null;
  const connected = channel?.connectionStatus === "CONNECTED";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tenantResponse, zernioResponse] = await Promise.all([
        fetch("/api/admin/tenants", { cache: "no-store" }),
        fetch("/api/admin/zernio/tenants", { cache: "no-store" })
      ]);
      const tenantBody = await tenantResponse.json();
      if (!tenantResponse.ok) throw new Error(tenantBody.error ?? "Unable to load customers.");
      const nextTenants = tenantBody.data.tenants as Tenant[];
      setTenants(nextTenants);
      setSelectedId((current) => nextTenants.some((item) => item.id === current) ? current : nextTenants[0]?.id ?? "");
      if (zernioResponse.ok) setProfiles((await zernioResponse.json()).data?.profiles ?? []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load customers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setProfileId(channel?.zernioProfileId ?? "");
    setAccountId(channel?.zernioAccountId ?? "");
    setDeleteConfirmation("");
  }, [channel, selectedId]);

  const tenantCommand = async (data: unknown) => {
    setSaving(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/tenants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to save changes.");
      await load(); return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save changes."); return false;
    } finally { setSaving(false); }
  };

  const zernioRequest = async (method: "PATCH" | "POST" | "DELETE") => {
    if (!selected) return;
    setSaving(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/zernio/tenants", {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(method === "PATCH" ? { tenantId: selected.id, profileId, accountId: accountId || undefined } : { tenantId: selected.id })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to manage the Zernio connection.");
      setNotice(method === "DELETE" ? "WhatsApp connection disconnected." : method === "POST" ? "Zernio connection verified." : "Zernio configuration saved.");
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to manage the Zernio connection."); }
    finally { setSaving(false); }
  };

  const deleteTenant = async () => {
    if (!selected || deleteConfirmation !== selected.name) return;
    setSaving(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/tenants", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: selected.id, confirmationName: deleteConfirmation }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to delete this customer.");
      setNotice(`${selected.name} and all linked data were deleted.`); setTab("general"); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to delete this customer."); }
    finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#69f0df]">Platform</p><h1 className="mt-2 text-3xl font-bold text-white">Customers</h1><p className="mt-1 text-sm text-slate-400">Manage every customer, user and WhatsApp connection.</p></div>
        <button onClick={() => setNewCustomerOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#28d9c6] px-4 py-2.5 text-sm font-semibold text-[#022a36]"><Plus className="h-4 w-4" />Add customer</button>
      </header>
      {notice ? <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{notice}</div> : null}
      <div className="grid min-h-[650px] gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="card flex min-h-0 flex-col">
          <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customers</span><button onClick={() => void load()} className="rounded-lg p-2 text-slate-300 hover:bg-white/10"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {tenants.map((tenant) => <button key={tenant.id} onClick={() => { setSelectedId(tenant.id); setTab("general"); }} className={`w-full rounded-xl border p-3 text-left ${tenant.id === selectedId ? "border-[#28d9c6]/60 bg-[#182236]" : "border-[#253149] bg-[#0b1323]"}`}><b className="block text-sm text-white">{tenant.name}</b><span className="mt-1 block text-xs text-slate-400">{tenant.users.length} users · {tenant.channels[0]?.connectionStatus ?? "Not configured"}</span></button>)}
          </div>
        </aside>
        <main className="min-w-0">
          {selected ? <>
            <section className="card"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-white">{selected.name}</h2><p className="mt-1 text-sm text-slate-400">{selected.industryType}</p></div>{connected ? <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />Connected</span> : null}</div><div className="mt-5 flex overflow-x-auto border-b border-[#253149]">{(["general", "users", "zernio", "settings"] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`border-b-2 px-4 py-3 text-sm font-semibold capitalize ${tab === item ? "border-[#28d9c6] text-[#69f0df]" : "border-transparent text-slate-400"}`}>{item}</button>)}</div></section>
            <section className="mt-4 card">
              {tab === "general" ? <GeneralTab tenant={selected} saving={saving} command={tenantCommand} /> : null}
              {tab === "users" ? <UsersTab tenant={selected} saving={saving} form={userForm} setForm={setUserForm} command={tenantCommand} onReset={(user) => { setResetUser(user); setNewPassword(""); }} /> : null}
              {tab === "zernio" ? <div className="space-y-5"><div><h3 className="text-lg font-semibold text-white">Zernio</h3><p className="mt-1 text-sm text-slate-400">The selected WhatsApp account remains visible after saving.</p></div><label className="block text-sm text-slate-200">Zernio profile<select className={inputClass} value={profileId} onChange={(e) => setProfileId(e.target.value)}><option value="">Select a profile</option>{profiles.map((profile) => <option key={profile._id} value={profile._id}>{profile.name} · {profile._id}</option>)}</select></label><label className="block text-sm text-slate-200">WhatsApp account ID<input className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Zernio WhatsApp account ID" /></label><div className="rounded-xl border border-[#253149] bg-[#0b1323] p-4 text-sm text-slate-300"><div className="flex items-center gap-2">Status: {connected ? <><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /><b className="text-emerald-300">Connected</b></> : <b className="text-white">{channel?.connectionStatus ?? "Not configured"}</b>}</div><p className="mt-2">Connected number: <b className="text-white">{channel?.whatsappPhoneNumber || "—"}</b></p></div><div className="flex flex-wrap justify-end gap-3">{channel ? <button disabled={saving} onClick={() => void zernioRequest("DELETE")} className="inline-flex items-center gap-2 rounded-xl border border-red-400/40 px-4 py-2.5 text-sm font-semibold text-red-300"><Unplug className="h-4 w-4" />Disconnect</button> : null}<button disabled={saving || !channel?.zernioProfileId} onClick={() => void zernioRequest("POST")} className="rounded-xl border border-[#28d9c6]/50 px-4 py-2.5 text-sm font-semibold text-[#69f0df] disabled:opacity-40">Test connection</button><button disabled={saving || !profileId.trim()} onClick={() => void zernioRequest("PATCH")} className="inline-flex items-center gap-2 rounded-xl bg-[#28d9c6] px-4 py-2.5 text-sm font-semibold text-[#022a36] disabled:opacity-40"><Save className="h-4 w-4" />Save</button></div></div> : null}
              {tab === "settings" ? <div className="space-y-5"><div><h3 className="text-lg font-semibold text-white">Customer settings</h3><p className="mt-1 text-sm text-slate-400">Danger zone for irreversible customer-level actions.</p></div><div className="rounded-2xl border border-red-500/35 bg-red-500/5 p-5"><h4 className="font-semibold text-red-200">Delete complete customer</h4><p className="mt-2 text-sm text-slate-400">This permanently deletes all users, repairs, conversations, contacts, messages, templates and settings for {selected.name}. Type the exact customer name to confirm.</p><input className={`${inputClass} max-w-xl`} value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} placeholder={selected.name} /><button disabled={saving || deleteConfirmation !== selected.name} onClick={() => void deleteTenant()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Trash2 className="h-4 w-4" />Delete customer permanently</button></div></div> : null}
            </section>
          </> : <section className="card text-sm text-slate-400">No customer selected.</section>}
        </main>
      </div>
      {newCustomerOpen ? <Modal title="Add customer" onClose={() => setNewCustomerOpen(false)}><form onSubmit={async (e) => { e.preventDefault(); if (await tenantCommand({ action: "createTenant", name: newCustomerName, industryType: "REPAIR" })) { setNewCustomerName(""); setNewCustomerOpen(false); } }} className="space-y-4"><input className="w-full rounded-xl border p-2.5" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Customer name" required /><button className="w-full rounded-xl bg-[#28d9c6] p-2.5 font-semibold text-[#022a36]">Create customer</button></form></Modal> : null}
      {resetUser && selected ? <Modal title={`Reset password — ${resetUser.name}`} onClose={() => setResetUser(null)}><form onSubmit={async (e) => { e.preventDefault(); if (await tenantCommand({ action: "resetPassword", tenantId: selected.id, userId: resetUser.id, password: newPassword })) setResetUser(null); }} className="space-y-4"><input className="w-full rounded-xl border p-2.5" type="password" minLength={12} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (min. 12 characters)" required /><button className="w-full rounded-xl bg-[#28d9c6] p-2.5 font-semibold text-[#022a36]">Set password</button></form></Modal> : null}
    </div>
  );
}

function GeneralTab({ tenant, saving, command }: { tenant: Tenant; saving: boolean; command: (data: unknown) => Promise<boolean> }) {
  const [values, setValues] = useState({ businessLabel: tenant.settings?.businessLabel ?? tenant.name, workItemLabel: tenant.settings?.workItemLabel ?? "Repair", assetLabel: tenant.settings?.assetLabel ?? "Asset", customerLabel: tenant.settings?.customerLabel ?? "Customer" });
  useEffect(() => setValues({ businessLabel: tenant.settings?.businessLabel ?? tenant.name, workItemLabel: tenant.settings?.workItemLabel ?? "Repair", assetLabel: tenant.settings?.assetLabel ?? "Asset", customerLabel: tenant.settings?.customerLabel ?? "Customer" }), [tenant]);
  const impersonate = async () => {
    const response = await fetch("/api/admin/impersonation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: tenant.id }) });
    if (!response.ok) return;
    startImpersonation(tenant.name);
    window.location.href = "/dashboard";
  };
  return <form onSubmit={(e) => { e.preventDefault(); void command({ action: "saveSettings", tenantId: tenant.id, ...values }); }} className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold text-white">General</h3><p className="mt-1 text-sm text-slate-400">Terminology used throughout this customer workspace.</p></div><button type="button" onClick={impersonate} className="inline-flex items-center gap-2 rounded-xl border border-[#28d9c6]/50 bg-[#28d9c6]/10 px-4 py-2 text-sm font-semibold text-[#69f0df]"><LogIn className="h-4 w-4" />Open as customer</button></div><div className="grid gap-4 md:grid-cols-2">{Object.entries(values).map(([key, value]) => <label key={key} className="text-sm capitalize text-slate-200">{key.replace(/Label$/, " label")}<input className={inputClass} value={value} onChange={(e) => setValues({ ...values, [key]: e.target.value })} /></label>)}</div><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#28d9c6] px-4 py-2.5 text-sm font-semibold text-[#022a36]"><Save className="h-4 w-4" />Save settings</button></form>;
}

function UsersTab({ tenant, saving, form, setForm, command, onReset }: { tenant: Tenant; saving: boolean; form: { name: string; email: string; password: string; role: User["role"] }; setForm: (value: { name: string; email: string; password: string; role: User["role"] }) => void; command: (data: unknown) => Promise<boolean>; onReset: (user: User) => void }) {
  return <div className="space-y-5"><div><h3 className="flex items-center gap-2 font-semibold text-white"><Users className="h-4 w-4" />Users</h3></div><div className="space-y-2">{tenant.users.map((user) => <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#253149] py-3"><div><b className="text-sm text-white">{user.name}</b><p className="text-xs text-slate-400">{user.email} · {user.role}</p></div><button onClick={() => onReset(user)} className="inline-flex items-center gap-1 rounded-lg border border-[#28d9c6]/50 px-3 py-1.5 text-xs text-[#69f0df]"><KeyRound className="h-3.5 w-3.5" />Reset password</button></div>)}</div><form onSubmit={async (e) => { e.preventDefault(); if (await command({ action: "createUser", tenantId: tenant.id, ...form })) setForm({ name: "", email: "", password: "", role: "TENANT_ADMIN" }); }} className="grid gap-3 md:grid-cols-2"><input className={inputClass} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /><input className={inputClass} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /><input className={inputClass} type="password" minLength={12} placeholder="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /><select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as User["role"] })}><option value="TENANT_OWNER">Owner</option><option value="TENANT_ADMIN">Admin</option><option value="EMPLOYEE">Employee</option></select><button disabled={saving} className="rounded-xl bg-[#28d9c6] p-2.5 font-semibold text-[#022a36] md:col-span-2">Add user</button></form></div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-900"><div className="mb-5 flex justify-between"><h2 className="text-xl font-bold">{title}</h2><button onClick={onClose}>×</button></div>{children}</div></div>; }
