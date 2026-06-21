import Link from "next/link";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { STAGES, STAGE_LABEL } from "@/lib/prospects";
import { ProspectQuickAdd } from "@/components/dashboard/prospect-quick-add";

type Row = { id: string; name: string; stage: string; region: string | null; setting_type: string | null };

export default async function SalesPage() {
  await requirePlatformAdmin();
  const db = createAdminClient();

  const since7 = new Date(Date.now() - 7 * 86400e3).toISOString();
  const [{ data }, { count: approvalCount }, { count: replyCount }] = await Promise.all([
    db.from("prospect_companies").select("id, name, stage, region, setting_type").order("created_at", { ascending: false }),
    db.from("prospect_activities").select("id", { count: "exact", head: true }).eq("needs_approval", true),
    db.from("prospect_activities").select("id", { count: "exact", head: true }).eq("type", "message").eq("direction", "inbound").gte("created_at", since7),
  ]);
  const rows = (data ?? []) as Row[];

  const byStage = new Map<string, Row[]>();
  for (const s of STAGES) byStage.set(s, []);
  for (const r of rows) (byStage.get(r.stage) ?? byStage.get("new")!).push(r);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Sales</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/sales/replies" className="rounded-lg border border-white/40 bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-white/30">
            Replies{replyCount ? ` (${replyCount})` : ""}
          </Link>
          <Link href="/admin/sales/approvals" className="rounded-lg border border-white/40 bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-white/30">
            Needs approval{approvalCount ? ` (${approvalCount})` : ""}
          </Link>
          <Link href="/admin/sales/sequences" className="rounded-lg border border-white/40 bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-white/30">
            Sequences
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-white/80">Your prospect pipeline. Add a company and move it through to Won.</p>

      <div className="mt-4">
        <ProspectQuickAdd />
      </div>

      <div className="mt-6 flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((s) => {
          const items = byStage.get(s) ?? [];
          return (
            <div key={s} className="w-64 shrink-0">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-white drop-shadow-sm">{STAGE_LABEL[s]}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">{items.length}</span>
              </div>
              <div className="mt-2 space-y-2">
                {items.map((r) => (
                  <Link
                    key={r.id}
                    href={`/admin/sales/${r.id}`}
                    className="block rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md"
                  >
                    <p className="truncate text-sm font-medium text-gray-900">{r.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {[r.setting_type?.replace("_", " "), r.region].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </Link>
                ))}
                {items.length === 0 && <p className="px-1 text-xs text-white/50">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
