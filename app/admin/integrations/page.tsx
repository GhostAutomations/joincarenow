import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

type EventRow = {
  id: string;
  target: string;
  event: string;
  status: string;
  attempt: number;
  error: string | null;
  created_at: string;
  companies: { name: string | null } | null;
  employees: { first_name: string | null; last_name: string | null } | null;
};

export default async function AdminIntegrationsPage() {
  await requirePlatformAdmin();
  const db = createAdminClient();

  const [{ data: rows }, { count: successCount }, { count: errorCount }] = await Promise.all([
    db
      .from("integration_events")
      .select("id, target, event, status, attempt, error, created_at, companies(name), employees(first_name, last_name)")
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("integration_events").select("id", { count: "exact", head: true }).eq("status", "success"),
    db.from("integration_events").select("id", { count: "exact", head: true }).eq("status", "error"),
  ]);

  const events = (rows ?? []) as unknown as EventRow[];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Integrations</h1>
      <p className="mt-1 text-sm text-white/80">Sync activity across the platform (Carer.Academy and future systems).</p>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:max-w-sm">
        <div className="rounded-2xl border border-white/25 bg-white/15 p-4 backdrop-blur-md">
          <p className="text-sm text-white/70">Successful syncs</p>
          <p className="mt-1 text-3xl font-semibold">{(successCount ?? 0).toLocaleString()}</p>
        </div>
        <div className={`rounded-2xl border p-4 backdrop-blur-md ${(errorCount ?? 0) > 0 ? "border-amber-300/60 bg-amber-400/15" : "border-white/25 bg-white/15"}`}>
          <p className="text-sm text-white/70">Errors</p>
          <p className={`mt-1 text-3xl font-semibold ${(errorCount ?? 0) > 0 ? "text-amber-200" : ""}`}>
            {(errorCount ?? 0).toLocaleString()}
          </p>
        </div>
      </div>

      <h2 className="mt-8 text-base font-medium text-white drop-shadow-sm">Recent events</h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.map((e) => {
              const emp = [e.employees?.first_name, e.employees?.last_name].filter(Boolean).join(" ") || "—";
              return (
                <tr key={e.id} className="align-top hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    {new Date(e.created_at).toLocaleString("en-GB")}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{e.companies?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{emp}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {e.target} · {e.event}
                    {e.attempt > 1 && <span className="text-gray-400"> (attempt {e.attempt})</span>}
                    {e.status === "error" && e.error && (
                      <p className="mt-0.5 text-xs text-red-600">{e.error}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        e.status === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {e.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                  No sync activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
