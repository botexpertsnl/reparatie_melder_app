import { Plus, Search, ChevronDown, MoreHorizontal } from "lucide-react";

type RepairItem = {
  id: string;
  title: string;
  vehicle: string;
  customer: string;
  stage: "Awaiting Approval" | "New";
  priority: "High" | "Medium" | "Low";
  status: "Open";
};

const repairs: RepairItem[] = [
  {
    id: "repair_1",
    title: "Annual service + brake inspection",
    vehicle: "VW Golf - 78-ZKL-3",
    customer: "Jan Bakker",
    stage: "Awaiting Approval",
    priority: "Medium",
    status: "Open"
  },
  {
    id: "repair_2",
    title: "AC system not cooling",
    vehicle: "Toyota Yaris - AB-123-CD",
    customer: "Maria Smits",
    stage: "Awaiting Approval",
    priority: "High",
    status: "Open"
  },
  {
    id: "repair_3",
    title: "Tyre replacement - 4x summer tyres",
    vehicle: "BMW 3 Series - GH-456-IJ",
    customer: "Peter van der Berg",
    stage: "New",
    priority: "Low",
    status: "Open"
  }
];

function StageBadge({ stage }: { stage: RepairItem["stage"] }) {
  if (stage === "Awaiting Approval") {
    return (
      <span className="inline-flex items-center gap-2 rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-sm font-semibold text-orange-400">
        <span className="h-2 w-2 rounded-full bg-orange-400" />
        {stage}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-700/20 px-3 py-1 text-sm font-semibold text-slate-300">
      <span className="h-2 w-2 rounded-full bg-slate-500" />
      {stage}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: RepairItem["priority"] }) {
  if (priority === "High") {
    return <span className="inline-flex rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-sm font-semibold text-orange-400">{priority}</span>;
  }

  if (priority === "Medium") {
    return <span className="inline-flex rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-300">{priority}</span>;
  }

  return <span className="inline-flex rounded-xl border border-slate-700 bg-slate-700/20 px-3 py-1 text-sm font-semibold text-slate-300">{priority}</span>;
}

export default function WorkItemsPage() {
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Repairs</h1>
          <p className="mt-1 text-sm text-slate-400">Manage ongoing repairs</p>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <button className="inline-flex h-11 min-w-40 items-center justify-between rounded-xl border border-[#253149] bg-[#0a111f] px-4 text-sm text-slate-400">
            All
            <ChevronDown className="ml-4 h-5 w-5" />
          </button>

          <label className="flex h-11 min-w-72 items-center gap-3 rounded-xl border border-[#253149] bg-[#0a111f] px-4 text-sm text-slate-400">
            <Search className="h-5 w-5" />
            <span className="text-sm">Search...</span>
          </label>

          <button className="inline-flex h-11 items-center gap-3 rounded-xl bg-[#28d9c6] px-5 text-sm font-semibold text-[#022a36]">
            <Plus className="h-5 w-5" />
            New Repair
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#253149] bg-[#121b2b]/65">
        <table className="w-full table-fixed">
          <thead className="border-b border-[#253149] text-left text-sm text-slate-400">
            <tr>
              <th className="w-[37%] px-5 py-4">Title</th>
              <th className="w-[20%] px-5 py-4">Customer</th>
              <th className="w-[19%] px-5 py-4">Stage</th>
              <th className="w-[10%] px-5 py-4">Priority</th>
              <th className="w-[9%] px-5 py-4">Status</th>
              <th className="w-[5%] px-5 py-4" />
            </tr>
          </thead>
          <tbody>
            {repairs.map((repair) => (
              <tr key={repair.id} className="border-b border-[#253149] last:border-b-0">
                <td className="px-5 py-4 align-middle">
                  <div className="text-lg font-semibold leading-tight text-white">{repair.title}</div>
                  <div className="mt-1 text-sm text-slate-500">{repair.vehicle}</div>
                </td>
                <td className="px-5 py-4 align-middle text-lg font-semibold text-white">{repair.customer}</td>
                <td className="px-5 py-4 align-middle">
                  <StageBadge stage={repair.stage} />
                </td>
                <td className="px-5 py-4 align-middle">
                  <PriorityBadge priority={repair.priority} />
                </td>
                <td className="px-5 py-4 align-middle">
                  <span className="inline-flex rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-300">{repair.status}</span>
                </td>
                <td className="px-5 py-4 align-middle text-center text-slate-400">
                  <button className="rounded-md p-1 hover:bg-slate-800/70" aria-label="Open row actions">
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
