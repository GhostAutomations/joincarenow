import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { formatLondon } from "@/lib/time";

type Row = {
  interview_id: string;
  application_id: string;
  scheduled_at: string;
  duration_minutes: number;
  mode: string | null;
  status: string;
  applicant_name: string | null;
  interviewer_id: string | null;
  interviewer_name: string | null;
};

const BLOCK: Record<string, string> = {
  proposed: "border-blue-300 bg-blue-50 text-blue-900",
  confirmed: "border-green-300 bg-green-50 text-green-900",
  reschedule_requested: "border-amber-300 bg-amber-50 text-amber-900",
  declined: "border-red-200 bg-red-50 text-red-800",
};

/** London "YYYY-MM-DD" for a Date. */
function londonDate(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const offset = Number.parseInt(week ?? "0") || 0;

  const { supabase, current } = await requireCompany();
  const [{ data: ivData }, { data: staffRaw }] = await Promise.all([
    supabase.rpc("get_company_interviews"),
    supabase
      .from("company_users")
      .select("user_id, profiles ( full_name, email )")
      .eq("company_id", current.company_id),
  ]);
  const rows = (ivData ?? []) as Row[];

  // Build the Monday→Sunday week for the given offset.
  const base = new Date(`${londonDate(new Date())}T00:00:00Z`);
  const dow = base.getUTCDay(); // 0=Sun..6=Sat
  base.setUTCDate(base.getUTCDate() + (dow === 0 ? -6 : 1 - dow) + offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    return d;
  });
  const dayKeys = days.map((d) => d.toISOString().slice(0, 10));

  const staff = (staffRaw ?? []).map((m) => {
    const p = m.profiles as unknown as { full_name: string | null; email: string } | null;
    return { user_id: m.user_id as string, name: p?.full_name || p?.email || "Team member" };
  });

  // index: rowKey ("unassigned" or user_id) -> dayKey -> Row[]
  const grid = new Map<string, Map<string, Row[]>>();
  const weekSet = new Set(dayKeys);
  for (const r of rows) {
    const dayKey = londonDate(new Date(r.scheduled_at));
    if (!weekSet.has(dayKey)) continue;
    const rowKey = r.interviewer_id ?? "unassigned";
    const byDay = grid.get(rowKey) ?? new Map<string, Row[]>();
    (byDay.get(dayKey) ?? byDay.set(dayKey, []).get(dayKey)!).push(r);
    grid.set(rowKey, byDay);
  }

  // Rows = all staff, plus an "Unassigned" row only if it has interviews.
  const rowList = [
    ...staff.map((s) => ({ key: s.user_id, name: s.name })),
    ...(grid.has("unassigned") ? [{ key: "unassigned", name: "Unassigned" }] : []),
  ];

  const rangeLabel = `${days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} – ${days[6].toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;
  const todayKey = londonDate(new Date());

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Interviews</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/interviews?week=${offset - 1}`} className="rounded-lg border border-gray-300 p-1.5 hover:bg-gray-100" aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-32 text-center font-medium text-gray-700">{rangeLabel}</span>
          <Link href={`/interviews?week=${offset + 1}`} className="rounded-lg border border-gray-300 p-1.5 hover:bg-gray-100" aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </Link>
          {offset !== 0 && (
            <Link href="/interviews" className="ml-1 text-brand-600 hover:underline">Today</Link>
          )}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-sm">
        <div className="min-w-[820px]">
          {/* Header row */}
          <div className="grid grid-cols-[160px_repeat(7,1fr)] border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500">
            <div className="px-3 py-2">Interviewer</div>
            {days.map((d, i) => {
              const isToday = dayKeys[i] === todayKey;
              return (
                <div key={i} className={`px-2 py-2 text-center ${isToday ? "text-brand-700" : ""}`}>
                  {d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}{" "}
                  <span className={isToday ? "font-bold" : ""}>{d.getUTCDate()}</span>
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {rowList.length === 0 ? (
            <p className="px-3 py-6 text-sm text-gray-500">No team members yet.</p>
          ) : (
            rowList.map((r) => (
              <div key={r.key} className="grid grid-cols-[160px_repeat(7,1fr)] border-b border-gray-100 last:border-0">
                <div className="flex items-center px-3 py-2 text-sm font-medium text-gray-800">{r.name}</div>
                {dayKeys.map((dk) => {
                  const items = grid.get(r.key)?.get(dk) ?? [];
                  return (
                    <div key={dk} className="min-h-16 space-y-1 border-l border-gray-100 p-1">
                      {items.map((iv) => (
                        <Link
                          key={iv.interview_id}
                          href={`/pipeline?open=${iv.application_id}`}
                          className={`block rounded-md border px-1.5 py-1 text-[11px] leading-tight ${BLOCK[iv.status] ?? "border-gray-200 bg-gray-50"}`}
                        >
                          <span className="font-semibold">
                            {formatLondon(iv.scheduled_at, { hour: "2-digit", minute: "2-digit" })}
                          </span>{" "}
                          {iv.applicant_name || "Applicant"}
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Times shown in UK time. Tap an interview to open the applicant.
      </p>
    </div>
  );
}
