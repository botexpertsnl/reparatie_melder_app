import { ArrowUpRight, CheckCircle2, Clock3, MessageSquareText, Users, Wrench } from "lucide-react";
import { demoCustomers, demoThreads, demoWorkItems } from "@/lib/dummy-data";

export default function DashboardPage() {
  const waitingApproval = demoWorkItems.filter((item) => item.stage.includes("approval")).length;
  const unread = demoThreads.reduce((total, thread) => total + thread.unread, 0);
  const metrics = [
    { label: "Active repairs", value: demoWorkItems.length, icon: Wrench, tone: "text-cyan-400", bg: "bg-cyan-400/10" },
    { label: "Waiting approval", value: waitingApproval, icon: Clock3, tone: "text-amber-400", bg: "bg-amber-400/10" },
    { label: "Customers", value: demoCustomers.length, icon: Users, tone: "text-violet-400", bg: "bg-violet-400/10" },
    { label: "Unread messages", value: unread, icon: MessageSquareText, tone: "text-emerald-400", bg: "bg-emerald-400/10" }
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-7">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Overview</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[var(--text-primary)]">Good afternoon</h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">Here is what needs your attention today.</p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 sm:self-auto">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" />
          All systems operational
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, tone, bg }) => (
          <article key={label} className="card group relative overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[var(--text-secondary)]">{label}</div>
                <div className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[var(--text-primary)]">{value}</div>
              </div>
              <div className={`grid h-11 w-11 place-items-center rounded-xl ${bg} ${tone}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-5 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
              View details <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Recent conversations</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Latest customer activity across your workspace.</p>
            </div>
            <button className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">View all</button>
          </div>
          <div className="mt-5 divide-y divide-[var(--border)]">
            {demoThreads.map((thread, index) => (
              <div key={thread.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-sm font-bold text-[var(--accent)]">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{thread.preview}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Customer conversation</p>
                </div>
                {thread.unread > 0 ? <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-ink)]">{thread.unread}</span> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Today&apos;s progress</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">A quick look at the current workload.</p>
          <div className="mt-6 flex items-center gap-5">
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-[9px] border-[var(--accent-soft)] border-t-[var(--accent)]">
              <span className="text-xl font-bold">72%</span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-[var(--text-secondary)]"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Tasks on track</div>
              <div className="flex items-center gap-2 text-[var(--text-secondary)]"><Clock3 className="h-4 w-4 text-amber-400" /> {waitingApproval} awaiting input</div>
              <div className="flex items-center gap-2 text-[var(--text-secondary)]"><MessageSquareText className="h-4 w-4 text-cyan-400" /> {unread} unread messages</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
