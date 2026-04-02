import Link from "next/link";

export default function WorkItemsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Work Items</h1>
      <div className="card space-y-3">
        <p>Status-based operational queue with stage chips, overdue markers, and quick transitions.</p>
        <Link className="btn inline-block" href="/work-items/demo">Open demo work item</Link>
      </div>
    </div>
  );
}
