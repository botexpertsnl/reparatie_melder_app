import Link from "next/link";
import { demoWorkItems } from "@/lib/dummy-data";

export default function WorkItemsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Work Items</h1>
      <div className="space-y-3">
        {demoWorkItems.map((item) => (
          <div key={item.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">{item.title}</div>
              <div className="text-xs text-slate-400">Stage: {item.stage} · Priority: {item.priority}</div>
            </div>
            <Link className="btn" href={`/work-items/${item.id}`}>Open</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
