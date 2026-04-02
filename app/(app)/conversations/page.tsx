import { demoCustomers, demoThreads } from "@/lib/dummy-data";

export default function ConversationsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Conversations</h1>
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <aside className="card space-y-2">
          {demoThreads.map((thread) => {
            const customer = demoCustomers.find((c) => c.id === thread.customerId);
            return (
              <div key={thread.id} className="rounded-lg border border-slate-800 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{customer?.fullName}</span>
                  {thread.unread > 0 ? <span className="badge">{thread.unread}</span> : null}
                </div>
                <p className="mt-1 text-sm text-slate-300">{thread.preview}</p>
              </div>
            );
          })}
        </aside>
        <section className="card">Select a thread to view messages and quick actions.</section>
      </div>
    </div>
  );
}
