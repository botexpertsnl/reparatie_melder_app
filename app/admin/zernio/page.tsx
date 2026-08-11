"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MessageCircleMore, RefreshCw, Save, TriangleAlert } from "lucide-react";

type ZernioProfile = { _id: string; name: string };
type Channel = {
  zernioProfileId?: string | null;
  zernioAccountId?: string | null;
  whatsappPhoneNumber?: string | null;
  connectionStatus?: string | null;
};
type TenantRow = { id: string; name: string; isActive: boolean; channel: Channel | null };

export default function ZernioAdminPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [profiles, setProfiles] = useState<ZernioProfile[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedTenantId, tenants]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/zernio/tenants", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not load Zernio configuration");
      const nextTenants = payload.data?.tenants ?? [];
      setTenants(nextTenants);
      setProfiles(payload.data?.profiles ?? []);
      setSelectedTenantId((current) => current || nextTenants[0]?.id || "");
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not load Zernio configuration" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setProfileId(selectedTenant?.channel?.zernioProfileId ?? "");
    setAccountId(selectedTenant?.channel?.zernioAccountId ?? "");
    setNotice(null);
  }, [selectedTenant]);

  const save = async () => {
    if (!selectedTenant || !profileId.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/zernio/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: selectedTenant.id, profileId: profileId.trim(), accountId: accountId.trim() || undefined })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not save Zernio profile");
      await load();
      setNotice({ kind: "success", text: payload.data?.channel?.connectionStatus === "CONNECTED"
        ? "Profile and WhatsApp account are linked to this tenant."
        : "Profile saved. Add a WhatsApp number to this profile in Zernio, then run the connection test." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not save Zernio profile" });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!selectedTenant) return;
    setTesting(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/zernio/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: selectedTenant.id })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Connection test failed");
      await load();
      setNotice({ kind: "success", text: `Connection successful${payload.data?.whatsappPhoneNumber ? ` for ${payload.data.whatsappPhoneNumber}` : ""}.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Connection test failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#28d9c6]/15 text-[#69f0df]"><MessageCircleMore className="h-5 w-5" /></span>
            <div>
              <h1 className="text-2xl font-semibold text-white">Zernio connections</h1>
              <p className="mt-1 text-sm text-slate-400">Assign one Zernio profile and WhatsApp account to each tenant.</p>
            </div>
          </div>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[#253149] bg-[#101a2c] px-4 py-2 text-sm font-medium text-slate-200 hover:border-[#28d9c6]/50 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {notice ? (
        <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${notice.kind === "success" ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200" : "border-amber-500/35 bg-amber-500/10 text-amber-100"}`}>
          {notice.kind === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="card space-y-2">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Tenants</p>
          {loading ? <div className="flex items-center gap-2 py-8 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading tenants…</div> : tenants.map((tenant) => (
            <button key={tenant.id} type="button" onClick={() => setSelectedTenantId(tenant.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedTenantId === tenant.id ? "border-[#28d9c6]/55 bg-[#182236]" : "border-[#253149] bg-[#0b1323] hover:border-[#34435f]"}`}>
              <div className="font-semibold text-white">{tenant.name}</div>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <span className={`h-2 w-2 rounded-full ${tenant.channel?.connectionStatus === "CONNECTED" ? "bg-emerald-400" : "bg-slate-500"}`} />
                {tenant.channel?.connectionStatus === "CONNECTED" ? "Connected" : tenant.channel?.zernioProfileId ? "Awaiting WhatsApp account" : "Not configured"}
              </div>
            </button>
          ))}
        </aside>

        <section className="card">
          {selectedTenant ? (
            <div className="space-y-6">
              <div className="border-b border-[#253149] pb-5">
                <h2 className="text-xl font-semibold text-white">{selectedTenant.name}</h2>
                <p className="mt-1 text-sm text-slate-400">The API key stays global and secret. Only tenant-specific profile/account IDs are stored here.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="zernio-profile" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Zernio profile *</label>
                  <select id="zernio-profile" value={profileId} onChange={(event) => { setProfileId(event.target.value); setAccountId(""); }} className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#30b5a5]">
                    <option value="">Select a profile</option>
                    {profiles.map((profile) => <option key={profile._id} value={profile._id}>{profile.name} · {profile._id}</option>)}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">You can also paste a profile ID below if it is not listed yet.</p>
                </div>
                <div>
                  <label htmlFor="zernio-profile-id" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Profile ID</label>
                  <input id="zernio-profile-id" value={profileId} onChange={(event) => setProfileId(event.target.value)} placeholder="Zernio profile ID" className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#30b5a5]" />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="zernio-account-id" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">WhatsApp account ID <span className="normal-case text-slate-600">(only needed when a profile has multiple numbers)</span></label>
                  <input id="zernio-account-id" value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder="Automatically selected when the profile has one connected WhatsApp account" className="w-full rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#30b5a5]" />
                </div>
              </div>

              <div className="rounded-2xl border border-[#253149] bg-[#0b1323] p-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><p className="text-xs text-slate-500">Status</p><p className="mt-1 font-medium text-white">{selectedTenant.channel?.connectionStatus ?? "Not configured"}</p></div>
                  <div><p className="text-xs text-slate-500">Account ID</p><p className="mt-1 break-all font-medium text-white">{selectedTenant.channel?.zernioAccountId ?? "—"}</p></div>
                  <div><p className="text-xs text-slate-500">WhatsApp number</p><p className="mt-1 font-medium text-white">{selectedTenant.channel?.whatsappPhoneNumber || "—"}</p></div>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <button type="button" onClick={testConnection} disabled={testing || !selectedTenant.channel?.zernioProfileId} className="inline-flex items-center gap-2 rounded-xl border border-[#28d9c6]/45 bg-[#28d9c6]/10 px-4 py-2.5 text-sm font-semibold text-[#7ff5e9] disabled:cursor-not-allowed disabled:opacity-45">
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Test connection
                </button>
                <button type="button" onClick={save} disabled={saving || !profileId.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#28d9c6] px-5 py-2.5 text-sm font-semibold text-[#022a36] disabled:cursor-not-allowed disabled:opacity-45">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save connection
                </button>
              </div>
            </div>
          ) : <p className="py-10 text-center text-sm text-slate-400">Select a tenant to configure Zernio.</p>}
        </section>
      </div>
    </div>
  );
}
