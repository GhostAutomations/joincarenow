import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

type LogRow = {
  id: string;
  company_id: string | null;
  action: string;
  entity_type: string;
  created_at: string;
  companies: { name: string | null } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; action?: string }>;
}) {
  await requirePlatformAdmin();
  const { company, action } = await searchParams;
  const db = createAdminClient();

  let query = db
    .from("audit_logs")
    .select("id, company_id, action, entity_type, created_at, companies(name), profiles:actor_id(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (company) query = query.eq("company_id", company);
  if (action) query = query.eq("action", action);

  const [{ data: rows }, { data: companies }] = await Promise.all([
    query,
    db.from("companies").select("id, name").order("name"),
  ]);

  const logs = (rows ?? []) as unknown as LogRow[];
  // Distinct actions for the filter (from the returned slice).
  const actions = Array.from(new Set(logs.map((l) => l.action))).sort();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Audit log</h1>
      <p className="mt-1 text-sm text-white/80">The 200 most recent actions across the platform.</p>

      <form method="get" className="mt-4 flex flex-wrap gap-2">
        <select name="company" defaultValue={company ?? ""} className="rounded-lg border border-white/40 bg-white/90 px-3 py-2 text-sm text-gray-900">
          <option value="">All companies</option>
          {(companies ?? []).map((c) => (
            <option key={c.id} value={c.id as string}>{c.name as string}</option>
          ))}
        </select>
        <select name="action" defaultValue={action ?? ""} className="rounded-lg border border-white/40 bg-white/90 px-3 py-2 text-sm text-gray-900">
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button className="rounded-lg border border-white/40 bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/30">
          Filter
        </button>
      </form>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md shadow-sm">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-white/60">
                <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                  {new Date(l.created_at).toLocaleString("en-GB")}
                </td>
                <td className="px-4 py-3 text-gray-700">{l.companies?.name ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">
                  {l.profiles?.full_name || l.profiles?.email || "System"}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <span className="font-medium">{l.action}</span>
                  <span className="text-gray-400"> · {l.entity_type}</span>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">
                  No audit entries match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
