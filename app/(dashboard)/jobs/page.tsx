import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import { reopenJob } from "@/modules/jobs/actions";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-green-100 text-green-800",
  closed: "bg-amber-100 text-amber-800",
  archived: "bg-gray-200 text-gray-600",
};

export default async function JobsPage() {
  const { supabase, current } = await requireCompany();

  const { data: allJobs } = await supabase
    .from("jobs")
    .select("id, title, location, employment_type, status, vacancies, created_at, applications(count)")
    .eq("company_id", current.company_id)
    .order("created_at", { ascending: false });

  const jobs = (allJobs ?? []).filter((j) => j.status !== "archived");
  const archived = (allJobs ?? []).filter((j) => j.status === "archived");

  return (
    <div>
      <PageHeader title="Jobs" subtitle="Create roles and publish them to your careers page.">
        <Link
          href="/jobs/new"
          className="inline-flex items-center gap-2 rounded-lg border border-white/40 bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/30"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New job
        </Link>
      </PageHeader>

      {(jobs ?? []).length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-gray-900">No jobs yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Create your first role, then publish it to your careers page.
          </p>
          <Link
            href="/jobs/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New job
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Applicants</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(jobs ?? []).map((j) => {
                const count =
                  (j.applications as unknown as { count: number }[] | null)?.[0]
                    ?.count ?? 0;
                return (
                  <tr key={j.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/jobs/${j.id}`} className="hover:text-brand-700">
                        {j.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{j.location || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {j.employment_type || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{count}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          STATUS_STYLES[j.status] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {j.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-6">
          <CollapsibleSection title="Archived jobs" count={archived.length}>
            <ul className="divide-y divide-slate-100">
              {archived.map((j) => {
                const count =
                  (j.applications as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
                return (
                  <li key={j.id} className="flex items-center justify-between gap-4 px-1 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/jobs/${j.id}`} className="font-medium text-gray-900 hover:text-brand-700">
                        {j.title}
                      </Link>
                      <p className="text-xs text-gray-500">
                        {count} applicant{count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <form action={reopenJob}>
                      <input type="hidden" name="id" value={j.id} />
                      <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100">
                        Reopen
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}
