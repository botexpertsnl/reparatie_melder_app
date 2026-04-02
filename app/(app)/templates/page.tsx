import { demoTemplates } from "@/lib/dummy-data";

export default function TemplatesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Templates</h1>
      <div className="card space-y-2">
        {demoTemplates.map((template) => (
          <div key={template.id} className="flex items-center justify-between rounded-md border border-slate-800 p-3 text-sm">
            <span>{template.name}</span>
            <span className="text-slate-400">{template.category} · {template.language}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
