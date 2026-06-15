import Link from "next/link";
import { Search } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";

type EmployeeRow = {
  id: string;
  employee_ref: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_title: string | null;
  start_date: string | null;
  status: "active" | "inactive" | "left";
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-50 text-green-700 ring-green-600/20",
  inactive: "bg-amber-50 text-amber-700 ring-amber-600/20",
  left: "bg-gray-100 text-gray-600 ring-gray-500/20",
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { supabase, current } = await requireCompany();

  const { data } = await supabase
    .from("employees")
    .select("id, employee_ref, first_name, last_name, email, job_title, start_date, status")
    .eq("company_id", current.company_id)
    .order("created_at", { ascending: false });

  let employees = (data ?? []) as EmployeeRow[];
  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    employees = employees.filter((e) => {
      const name = [e.first_name, e.last_name].filter(Boolean).join(" ").toLowerCase();
      return (
        name.includes(needle) ||
        (e.email ?? "").toLowerCase().includes(needle) ||
        e.employee_ref.toLowerCase().includes(needle)
      );
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Employees</h1>
      <p className="mt-1 text-sm text-gray-500">
        The master record for everyone hired through Join Care Now. Created automatically when an applicant reaches Hired.
      </p>

      <form method="get" className="mt-4 max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name, email or ID"
            className="block w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </form>

      {employees.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          {q ? "No employees match your search." : "No employees yet. Hire an applicant on the Pipeline to create one."}
        </p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Employee ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Start date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((e) => {
                const name =
                  [e.first_name, e.last_name].filter(Boolean).join(" ") || e.email || "Employee";
                return (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{e.employee_ref}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/employees/${e.id}`} className="hover:text-brand-600 hover:underline">
                        {name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{e.job_title || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {e.start_date ? new Date(e.start_date).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STATUS_STYLE[e.status]}`}
                      >
                        {e.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
