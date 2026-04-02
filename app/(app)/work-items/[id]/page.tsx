export default async function WorkItemDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Work Item {id}</h1>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="card space-y-2">
          <h2 className="font-medium">Timeline</h2>
          <p className="text-sm text-slate-300">Stage history, approval events, and outbound communication timeline.</p>
        </section>
        <aside className="card space-y-2">
          <h2 className="font-medium">Quick Actions</h2>
          <button className="btn w-full">Move to next stage</button>
          <button className="btn w-full">Send suggested template</button>
        </aside>
      </div>
    </div>
  );
}
