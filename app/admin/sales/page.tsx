import Link from "next/link";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProspectQuickAdd } from "@/components/dashboard/prospect-quick-add";
import { ProspectBoard, type BoardCard } from "@/components/dashboard/prospect-board";
import { AutoSendToggle } from "@/components/dashboard/autosend-toggle";
import { ProspectLive } from "@/components/dashboard/prospect-live";
import { getAutoSendMode } from "@/lib/prospects/ai-drafts";

type Row = {
  id: string; name: string; stage: string; setting_type: string | null;
  region: string | null; source: string | null; value_monthly: number | null; stage_changed_at: string | null;
};

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; setting?: string; region?: string }>;
}) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  const { q, setting, region } = await searchParams;

  const since7 = new Date(Date.now() - 7 * 86400e3).toISOString();
  const [{ data: companies }, { data: msgs }, { data: tasks }, { data: contacts }, { count: approvalCount }, { count: replyCount }] = await Promise.all([
    db.from("prospect_companies").select("id, name, stage, setting_type, region, source, value_monthly, stage_changed_at").order("created_at", { ascending: false }),
    db.from("prospect_activities").select("prospect_company_id, created_at").eq("type", "message").eq("direction", "outbound").order("created_at", { ascending: false }),
    db.from("prospect_tasks").select("prospect_company_id, due_date").eq("done", false).not("due_date", "is", null).order("due_date", { ascending: true }),
    db.from("prospect_contacts").select("prospect_company_id, name, email").order("created_at", { ascending: true }),
    db.from("prospect_activities").select("id", { count: "exact", head: true }).eq("needs_approval", true),
    db.from("prospect_activities").select("id", { count: "exact", head: true }).eq("type", "message").eq("direction", "inbound").gte("created_at", since7),
  ]);

  const allRows = (companies ?? []) as Row[];
  const lastContact = new Map<string, string>();
  for (const m of msgs ?? []) if (!lastContact.has(m.prospect_company_id)) lastContact.set(m.prospect_company_id, m.created_at as string);
  const nextTask = new Map<string, string>();
  for (const t of tasks ?? []) if (!nextTask.has(t.prospect_company_id)) nextTask.set(t.prospect_company_id, t.due_date as string);
  const firstContact = new Map<string, string>();
  for (const ct of contacts ?? []) if (!firstContact.has(ct.prospect_company_id)) firstContact.set(ct.prospect_company_id, (ct.name || ct.email) as string);

  const settings = [...new Set(allRows.map((r) => r.setting_type).filter(Boolean))] as string[];
  const regions = [...new Set(allRows.map((r) => r.region).filter(Boolean))] as string[];

  const term = (q ?? "").trim().toLowerCase();
  const rows = allRows.filter((r) => {
    if (setting && r.setting_type !== setting) return false;
    if (region && r.region !== region) return false;
    if (term) {
      const hay = `${r.name} ${firstContact.get(r.id) ?? ""}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  const cards: BoardCard[] = rows.map((r) => ({
    id: r.id, name: r.name, stage: r.stage, setting: r.setting_type, region: r.region,
    value: r.value_monthly, contact: firstContact.get(r.id) ?? null,
    lastContactAt: lastContact.get(r.id) ?? null, nextTaskDue: nextTask.get(r.id) ?? null,
    stageChangedAt: r.stage_changed_at,
  }));

  const autoSendMode = await getAutoSendMode(db);
  const openValue = rows.filter((r) => !["won", "lost"].includes(r.stage)).reduce((s, r) => s + (r.value_monthly ?? 0), 0);
  const wonValue = rows.filter((r) => r.stage === "won").reduce((s, r) => s + (r.value_monthly ?? 0), 0);
  const openCount = rows.filter((r) => !["won", "lost"].includes(r.stage)).length;
  const money = (n: number) => "£" + n.toLocaleString();

  return (
    <div>
      <ProspectLive />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Sales</h1>
        <div className="flex flex-wrap items-center gap-2">
          <AutoSendToggle mode={autoSendMode} />
          <Link href="/admin/sales/conversations" className="rounded-lg border border-white/40 bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-white/30">
            Conversations{replyCount ? ` (${replyCount})` : ""}
          </Link>
          <Link href="/admin/sales/approvals" className="rounded-lg border border-white/40 bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-white/30">
            Needs approval{approvalCount ? ` (${approvalCount})` : ""}
          </Link>
          <Link href="/admin/sales/sequences" className="rounded-lg border border-white/40 bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-white/30">
            Sequences
          </Link>
        </div>
      </div>

      {/* Metrics */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Open prospects", value: openCount.toString() },
          { label: "Open value /mo", value: money(openValue) },
          { label: "Won value /mo", value: money(wonValue) },
          { label: "Total prospects", value: allRows.length.toString() },
        ].map((m) => (
          <div key={m.label} className="flex items-baseline justify-between rounded-xl border border-white/25 bg-white/15 px-3 py-2 backdrop-blur-md">
            <p className="text-xs text-white/70">{m.label}</p>
            <p className="text-lg font-semibold text-white">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <ProspectQuickAdd />
      </div>

      {/* Filters */}
      <form method="get" className="mt-3 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q ?? ""} placeholder="Search company or contact…" className="w-56 rounded-lg border border-white/40 bg-white/90 px-3 py-1.5 text-sm text-gray-900" />
        <select name="setting" defaultValue={setting ?? ""} className="rounded-lg border border-white/40 bg-white/90 px-3 py-1.5 text-sm text-gray-900">
          <option value="">All settings</option>
          {settings.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select name="region" defaultValue={region ?? ""} className="rounded-lg border border-white/40 bg-white/90 px-3 py-1.5 text-sm text-gray-900">
          <option value="">All regions</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button className="rounded-lg border border-white/40 bg-white/20 px-4 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-white/30">Filter</button>
        {(q || setting || region) && (
          <Link href="/admin/sales" className="text-sm text-white/70 hover:text-white">Clear</Link>
        )}
      </form>

      <div className="mt-4">
        <ProspectBoard initial={cards} />
      </div>
    </div>
  );
}
