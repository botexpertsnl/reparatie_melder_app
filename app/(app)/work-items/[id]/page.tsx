"use client";

import { useParams } from "next/navigation";
import { useDemoStore } from "@/lib/demo-store";

const stages = ["New", "Scheduled", "In progress", "Waiting for customer approval", "Ready for pickup", "Completed"];

export default function WorkItemDetail() {
  const params = useParams<{ id: string }>();
  const { workItems, customers, assets, isReady } = useDemoStore();
  if (!isReady) return <div className="card">Loading demo data...</div>;

  const item = workItems.value.find((w) => w.id === params.id);
  if (!item) return <div className="card">Work item not found.</div>;

  const customer = customers.value.find((c) => c.id === item.customerId);
  const asset = assets.value.find((a) => a.id === item.assetId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{item.title}</h1>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="card space-y-2">
          <div className="text-sm text-slate-300">Customer: {customer?.fullName}</div>
          <div className="text-sm text-slate-300">Asset: {asset?.displayName}</div>
          <div className="text-sm text-slate-300">Priority: {item.priority}</div>
          <div className="text-sm text-slate-300">Current Stage: {item.stage}</div>
        </section>
        <aside className="card space-y-2">
          <h2 className="font-medium">Quick Actions</h2>
          <select
            className="input"
            value={item.stage}
            onChange={(e) => workItems.update((prev) => prev.map((w) => (w.id === item.id ? { ...w, stage: e.target.value } : w)))}
          >
            {stages.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className="btn w-full">Send template (demo)</button>
        </aside>
      </div>
    </div>
  );
}
