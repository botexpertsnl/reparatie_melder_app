import { demoAssets } from "@/lib/dummy-data";

export default function AssetsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Assets</h1>
      <div className="grid gap-3 md:grid-cols-3">
        {demoAssets.map((asset) => (
          <article key={asset.id} className="card">
            <div className="text-xs text-slate-400">{asset.type}</div>
            <div className="mt-1 font-medium">{asset.displayName}</div>
            <div className="mt-2 text-sm text-slate-300">Identifier: {asset.identifier}</div>
          </article>
        ))}
      </div>
    </div>
  );
}
