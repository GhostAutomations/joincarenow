import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { dismissError, clearErrors } from "@/modules/admin/error-actions";

type ErrRow = {
  id: string;
  source: string;
  code: string | null;
  message: string;
  detail: unknown;
  created_at: string;
  companies: { name: string | null } | null;
};

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  await requirePlatformAdmin();
  const { source } = await searchParams;
  const db = createAdminClient();

  let query = db
    .from("error_logs")
    .select("id, source, code, message, detail, created_at, companies(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (source) query = query.eq("source", source);

  const { data } = await query;
  const errors = (data ?? []) as unknown as ErrRow[];
  const sources = Array.from(new Set(errors.map((e) => e.source))).sort();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Errors</h1>
      <p className="mt-1 text-sm text-white/80">
        The 200 most recent platform errors (server exceptions and failed email/SMS sends).
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <form method="get" className="flex items-center gap-2">
          <select name="source" defaultValue={source ?? ""} className="rounded-lg border border-white/40 bg-white/90 px-3 py-2 text-sm text-gray-900">
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button className="rounded-lg border border-white/40 bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/30">
            Filter
          </button>
        </form>
        {errors.length > 0 && (
          <form action={clearErrors} className="ml-auto">
            <input type="hidden" name="source" value={source ?? ""} />
            <button className="rounded-lg border border-white/40 bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/30">
              Clear {source ? `“${source}”` : "all"}
            </button>
          </form>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {errors.length === 0 && (
          <div className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-8 text-center text-sm text-gray-500 shadow-sm">
            No errors logged. 🎉
          </div>
        )}
        {errors.map((e) => (
          <div key={e.id} className="rounded-xl border border-white/40 bg-white/70 backdrop-blur-md p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800">{e.source}</span>
              {e.code && <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-gray-700">{e.code}</span>}
              {e.companies?.name && <span>{e.companies.name}</span>}
              <span className="ml-auto">{new Date(e.created_at).toLocaleString("en-GB")}</span>
              <form action={dismissError}>
                <input type="hidden" name="id" value={e.id} />
                <button aria-label="Dismiss" className="rounded-md px-2 py-0.5 font-medium text-gray-400 hover:bg-white/70 hover:text-gray-700">
                  Dismiss
                </button>
              </form>
            </div>
            <p className="mt-1.5 text-sm font-medium text-gray-900">{e.message}</p>
            {e.detail != null && (
              <details className="mt-1.5">
                <summary className="cursor-pointer text-xs font-medium text-brand-700">Details</summary>
                <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-gray-50 p-2 text-xs text-gray-700">
                  {JSON.stringify(e.detail, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
