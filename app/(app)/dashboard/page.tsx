import { getSystemAdminStats, getTenantDashboardStats } from "@/server/repositories/tenant-repository";

async function getData() {
  try {
    return {
      tenant: await getTenantDashboardStats(process.env.DEMO_TENANT_ID ?? ""),
      admin: await getSystemAdminStats()
    };
  } catch {
    return {
      tenant: { active: 0, waitingApproval: 0, completedToday: 0, unreadConversations: 0, messagesSentToday: 0 },
      admin: { totalTenants: 0, activeTenants: 0, tenantsWithActiveChannel: 0, recentWebhookFailures: 0 }
    };
  }
}

export default async function DashboardPage() {
  const { tenant, admin } = await getData();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Operational Dashboard</h1>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Object.entries(tenant).map(([k, v]) => (
          <div key={k} className="card">
            <div className="text-sm text-slate-400">{k}</div>
            <div className="mt-2 text-2xl font-semibold">{v}</div>
          </div>
        ))}
      </section>
      <h2 className="text-xl font-semibold">System Admin Snapshot</h2>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(admin).map(([k, v]) => (
          <div key={k} className="card">
            <div className="text-sm text-slate-400">{k}</div>
            <div className="mt-2 text-2xl font-semibold">{v}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
