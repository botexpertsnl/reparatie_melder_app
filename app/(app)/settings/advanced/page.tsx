"use client";

const settingsSections = [
  "General tenant settings",
  "Terminology settings",
  "Workflow stage settings",
  "Stage transition settings",
  "Approval behavior settings",
  "Messaging settings",
  "Spotler channel settings",
  "Template mapping settings",
  "Visibility rules",
  "Automation defaults"
];

const keys = ["demo_customers", "demo_assets", "demo_work_items", "demo_templates", "demo_threads"];

export default function AdvancedSettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Advanced Tenant Settings</h1>
      <div className="card flex items-center justify-between">
        <p className="text-sm text-slate-300">Demo mode: reset all local dummy data for this browser.</p>
        <button
          className="btn"
          onClick={() => {
            keys.forEach((k) => localStorage.removeItem(k));
            window.location.reload();
          }}
        >
          Reset Demo Data
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {settingsSections.map((section) => (
          <div className="card" key={section}>
            <div className="font-medium">{section}</div>
            <p className="mt-1 text-sm text-slate-300">Configurable per tenant with strict tenant-scoped persistence.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
