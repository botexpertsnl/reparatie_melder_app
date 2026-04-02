import Link from "next/link";

const nav = [
  ["Dashboard", "/dashboard"],
  ["Customers", "/customers"],
  ["Assets", "/assets"],
  ["Work Items", "/work-items"],
  ["Conversations", "/conversations"],
  ["Templates", "/templates"],
  ["Advanced Settings", "/settings/advanced"],
  ["Admin", "/admin/diagnostics"]
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      <aside className="border-b border-slate-800 bg-slate-950 md:border-b-0 md:border-r">
        <div className="p-4 text-lg font-semibold">StatusFlow</div>
        <nav className="flex gap-1 overflow-x-auto p-2 md:block">
          {nav.map(([name, href]) => (
            <Link key={href} href={href} className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800">
              {name}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="p-4 md:p-6">{children}</main>
    </div>
  );
}
