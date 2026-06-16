import Link from "next/link";
import { Search } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { PageHeader } from "@/components/dashboard/page-header";

type Row = {
  applicant_id: string;
  created_at: string;
  jobs: { title: string } | null;
  applicants: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

type Grouped = {
  id: string;
  name: string;
  email: string;
  phone: string;
  count: number;
  latest: string;
  roles: string[];
};

export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { supabase, current } = await requireCompany();

  const { data } = await supabase
    .from("applications")
    .select(
      "applicant_id, created_at, jobs(title), applicants(first_name, last_name, email, phone)"
    )
    .eq("company_id", current.company_id)
    .order("created_at", { ascending: false });

  // One row per applicant, with all roles they've applied for at this company.
  const byApplicant = new Map<string, Grouped>();
  for (const r of (data ?? []) as unknown as Row[]) {
    const name =
      [r.applicants?.first_name, r.applicants?.last_name]
        .filter(Boolean)
        .join(" ") ||
      r.applicants?.email ||
      "Applicant";
    const existing = byApplicant.get(r.applicant_id);
    if (existing) {
      existing.count += 1;
      if (r.jobs?.title) existing.roles.push(r.jobs.title);
    } else {
      byApplicant.set(r.applicant_id, {
        id: r.applicant_id,
        name,
        email: r.applicants?.email ?? "",
        phone: r.applicants?.phone ?? "",
        count: 1,
        latest: r.created_at,
        roles: r.jobs?.title ? [r.jobs.title] : [],
      });
    }
  }

  let applicants = [...byApplicant.values()];
  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    applicants = applicants.filter(
      (a) =>
        a.name.toLowerCase().includes(needle) ||
        a.email.toLowerCase().includes(needle)
    );
  }

  return (
    <div>
      <PageHeader title="Applicants" subtitle="Everyone who has applied to your company." />

      <form method="get" className="mt-4 max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name or email"
            className="block w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </form>

      {applicants.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          {q ? "No applicants match your search." : "No applicants yet."}
        </p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-sm">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Applied for</th>
                <th className="px-4 py-3">Latest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {applicants.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>{a.email}</div>
                    {a.phone && <div className="text-xs text-gray-400">{a.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {a.roles.length > 0 ? a.roles.join(", ") : "—"}
                    {a.count > 1 && (
                      <span className="ml-1 text-xs text-gray-400">
                        ({a.count} applications)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(a.latest).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        Review and move applicants through stages on the{" "}
        <Link href="/pipeline" className="text-brand-600 hover:underline">
          Pipeline
        </Link>
        .
      </p>
    </div>
  );
}
