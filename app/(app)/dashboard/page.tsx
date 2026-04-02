import { demoCustomers, demoThreads, demoWorkItems } from "@/lib/dummy-data";

export default function DashboardPage() {
  const waitingApproval = demoWorkItems.filter((x) => x.stage.includes("approval")).length;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Operational Dashboard (Dummy Data)</h1>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card"><div className="text-sm text-slate-400">Active work items</div><div className="mt-2 text-2xl font-semibold">{demoWorkItems.length}</div></div>
        <div className="card"><div className="text-sm text-slate-400">Waiting approval</div><div className="mt-2 text-2xl font-semibold">{waitingApproval}</div></div>
        <div className="card"><div className="text-sm text-slate-400">Customers</div><div className="mt-2 text-2xl font-semibold">{demoCustomers.length}</div></div>
        <div className="card"><div className="text-sm text-slate-400">Unread conversations</div><div className="mt-2 text-2xl font-semibold">{demoThreads.reduce((a, b) => a + b.unread, 0)}</div></div>
      </section>
      <section className="card">
        <h2 className="font-medium">Recent replies</h2>
        <ul className="mt-2 space-y-2 text-sm text-slate-300">
          {demoThreads.map((thread) => (
            <li key={thread.id}>• {thread.preview}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
