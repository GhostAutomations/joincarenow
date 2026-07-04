import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const TABS: { key: string; label: string }[] = [
  { key: "sms", label: "SMS" },
  { key: "ai", label: "AI" },
  { key: "ruby", label: "Ruby" },
];

/**
 * Founder drill-down: what a company's SMS / AI / Ruby usage was actually used
 * for, in case a client queries their bill. GDPR-safe — SMS shows date, count and
 * reason only (no recipient or message content).
 */
export default async function CompanyUsagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const { kind: kindRaw } = await searchParams;
  const kind = kindRaw === "ai" ? "ai" : kindRaw === "ruby" ? "ruby" : "sms";
  const db = createAdminClient();

  const { data: company } = await db.from("companies").select("name").eq("id", id).single();
  if (!company) notFound();

  let heading = "SMS sent";
  let columns: string[] = [];
  let rows: (string | number)[][] = [];

  if (kind === "ruby") {
    heading = "Ruby screenings";
    const { data } = await db
      .from("ruby_applicant_credits")
      .select("consumed_at, applications ( applicants ( first_name, last_name ), jobs ( title ) )")
      .eq("company_id", id)
      .order("consumed_at", { ascending: false })
      .limit(500);
    columns = ["Date", "Applicant", "Role"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows = ((data ?? []) as any[]).map((r) => {
      const app = r.applications;
      const name = [app?.applicants?.first_name, app?.applicants?.last_name].filter(Boolean).join(" ") || "—";
      return [fmtDate(r.consumed_at as string), name, (app?.jobs?.title as string) ?? "—"];
    });
  } else if (kind === "ai") {
    heading = "AI actions";
    const { data } = await db
      .from("usage_events")
      .select("created_at, label, actor_id")
      .eq("company_id", id)
      .eq("kind", "ai")
      .order("created_at", { ascending: false })
      .limit(500);
    const actorIds = [...new Set((data ?? []).map((d) => d.actor_id).filter(Boolean))] as string[];
    const { data: profs } = actorIds.length
      ? await db.from("profiles").select("id, full_name, email").in("id", actorIds)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
    const nameOf = new Map((profs ?? []).map((p) => [p.id as string, (p.full_name as string) || (p.email as string) || "—"]));
    columns = ["Date", "Task", "Account"];
    rows = (data ?? []).map((d) => [
      fmtDate(d.created_at as string),
      (d.label as string) ?? "AI action",
      d.actor_id ? nameOf.get(d.actor_id as string) ?? "—" : "Automatic",
    ]);
  } else {
    heading = "SMS sent";
    const { data } = await db
      .from("usage_events")
      .select("created_at, quantity, label")
      .eq("company_id", id)
      .eq("kind", "sms")
      .order("created_at", { ascending: false })
      .limit(2000);
    // Aggregate by day + reason — GDPR-safe (no recipient or content stored/shown).
    const map = new Map<string, { date: string; reason: string; count: number }>();
    for (const d of data ?? []) {
      const day = new Date(d.created_at as string).toISOString().slice(0, 10);
      const reason = (d.label as string) ?? "Message";
      const key = `${day}__${reason}`;
      const cur = map.get(key) ?? { date: d.created_at as string, reason, count: 0 };
      cur.count += (d.quantity as number) ?? 1;
      map.set(key, cur);
    }
    columns = ["Date", "SMS sent", "Reason"];
    rows = [...map.values()]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((v) => [fmtDate(v.date), v.count, v.reason]);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/founder/billing/${id}`} className="text-sm text-white/70 hover:text-white">← {company.name as string}</Link>
      <h1 className="mt-1 text-2xl font-semibold text-white drop-shadow-sm">Usage detail</h1>

      {/* Kind switcher */}
      <div className="mt-4 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/founder/billing/${id}/usage?kind=${t.key}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium backdrop-blur transition ${
              kind === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "border border-white/40 bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">{heading}</h2>
          <span className="text-xs text-gray-500">{rows.length} {rows.length === 1 ? "entry" : "entries"} · this year</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">Nothing recorded yet.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>{columns.map((c) => <th key={c} className="px-5 py-2.5">{c}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-white/60">
                  {r.map((cell, j) => (
                    <td key={j} className={`px-5 py-2.5 ${j === 0 ? "text-gray-500" : "font-medium text-gray-900"}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {kind === "sms" && (
        <p className="mt-3 text-xs text-white/60">Shows date, count and reason only — no recipients or message content.</p>
      )}
    </div>
  );
}
