export default function DiagnosticsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">System Admin Diagnostics</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">Webhook failures by tenant/channel.</div>
        <div className="card">Outbound send failures by tenant/channel.</div>
        <div className="card">Tenants missing workflow setup/template mappings.</div>
        <div className="card">Messaging channel health overview.</div>
      </div>
    </div>
  );
}
