import { demoCustomers } from "@/lib/dummy-data";

export default function CustomersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-400">
            <tr><th className="py-2 text-left">Name</th><th className="py-2 text-left">Phone</th><th className="py-2 text-left">Email</th></tr>
          </thead>
          <tbody>
            {demoCustomers.map((customer) => (
              <tr key={customer.id} className="border-t border-slate-800">
                <td className="py-2">{customer.fullName}</td>
                <td className="py-2">{customer.phone}</td>
                <td className="py-2">{customer.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
