import Link from "next/link";
import { Search, MapPin, Users } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { PageHeader } from "@/components/dashboard/page-header";

type EmployeeRow = {
  id: string;
  employee_ref: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_title: string | null;
  branch: string | null;
  worker_category: string | null;
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
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const { q, view: viewParam } = await searchParams;
  const view = viewParam === "left" || viewParam === "all" ? viewParam : "active";
  const { supabase, current } = await requireCompany();

  const { data } = await supabase
    .from("employees")
    .select(
      "id, employee_ref, first_name, last_name, email, job_title, branch, worker_category, start_date, status"
    )
    .eq("company_id", current.company_id)
    .order("created_at", { ascending: false });

  const allEmployees = (data ?? []) as EmployeeRow[];

  // Build the branch → worker-category breakdown from active employees.
  const active = allEmployees.filter((e) => e.status === "active");
  const branchMap = new Map<string, Map<string, number>>();
  for (const e of active) {
    const branch = e.branch?.trim() || "Unassigned";
    const category = e.worker_category?.trim() || "Uncategorised";
    const cats = branchMap.get(branch) ?? new Map<string, number>();
    cats.set(category, (cats.get(category) ?? 0) + 1);
    branchMap.set(branch, cats);
  }
  const branches = [...branchMap.entries()]
    .map(([branch, cats]) => ({
      branch,
      total: [...cats.values()].reduce((a, b) => a + b, 0),
      categories: [...cats.entries()].sort((a, b) => b[1] - a[1]),
    }))
    .sort((a, b) => b.total - a.total);

  let employees = view === "all" ? allEmployees : allEmployees.filter((e) => (view === "left" ? e.status === "left" : e.status !== "left"));
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
      <PageHeader
        title="Employees"
        subtitle="The master record for everyone hired through Join Care Now — created automatically when an applicant reaches Hired."
      />

      {branches.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Users className="h-4 w-4 text-gray-400" />
            {active.length} active {active.length === 1 ? "employee" : "employees"} across{" "}
            {branches.length} {branches.length === 1 ? "branch" : "branches"}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((r) => (
              <div key={r.branch} className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                    <MapPin className="h-4 w-4 text-brand-500" />
                    {r.branch}
                  </div>
                  <span className="text-lg font-semibold text-gray-900">{r.total}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.categories.map(([cat, n]) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                    >
                      {cat}
                      <span className="font-semibold text-gray-900">{n}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form method="get" className="max-w-sm flex-1">
          <input type="hidden" name="view" value={view} />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search by name, email or ID"
              className="block w-full rounded-lg border border-white/40 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </form>
        <div className="flex gap-1.5">
          {([["active", "Active"], ["left", "Leavers"], ["all", "All"]] as const).map(([key, label]) => (
            <Link
              key={key}
              href={`/employees?view=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${view === key ? "bg-brand-600 text-white" : "bg-white/80 text-gray-700 hover:bg-white"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-8 text-center text-sm text-gray-500 shadow-sm">
          {q ? "No employees match your search." : "No employees yet. Hire an applicant on the Pipeline to create one."}
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Employee ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Start date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((e) => {
                const name =
                  [e.first_name, e.last_name].filter(Boolean).join(" ") || e.email || "Employee";
                return (
                  <tr key={e.id} className="hover:bg-white/60">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {e.employee_ref || <span className="text-gray-300">Not set</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/employees/${e.id}`} className="hover:text-brand-600 hover:underline">
                        {name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {e.job_title || "—"}
                      {e.worker_category && (
                        <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                          {e.worker_category}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{e.branch || "—"}</td>
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
