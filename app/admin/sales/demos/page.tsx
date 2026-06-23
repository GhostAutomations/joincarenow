import Link from "next/link";
import { ChevronLeft, ChevronRight, Video } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

type Demo = { id: string; name: string; demo_at: string };

function londonParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { ymd: `${g("year")}-${g("month")}-${g("day")}`, hm: `${g("hour")}:${g("minute")}` };
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function DemosCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePlatformAdmin();
  const { month } = await searchParams;
  const db = createAdminClient();

  // Resolve the displayed month (default: current month, UK).
  const today = new Date();
  const m = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [yr, mo] = m.split("-").map(Number); // mo is 1-based
  const monthStart = new Date(Date.UTC(yr, mo - 1, 1));
  const nextMonth = new Date(Date.UTC(yr, mo, 1));
  const prevM = `${new Date(Date.UTC(yr, mo - 2, 1)).getUTCFullYear()}-${String(new Date(Date.UTC(yr, mo - 2, 1)).getUTCMonth() + 1).padStart(2, "0")}`;
  const nextM = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}`;

  // Pull demos in a slightly widened window (London boundaries) then bucket.
  const [{ data }, { data: vlRow }] = await Promise.all([
    db.from("prospect_companies")
      .select("id, name, demo_at")
      .not("demo_at", "is", null)
      .gte("demo_at", new Date(monthStart.getTime() - 86400e3).toISOString())
      .lt("demo_at", new Date(nextMonth.getTime() + 86400e3).toISOString())
      .order("demo_at", { ascending: true }),
    db.from("platform_settings").select("value").eq("key", "prospect_video_link").maybeSingle(),
  ]);
  const demos = (data ?? []) as Demo[];
  const videoLink = ((vlRow?.value as string) || "").trim();
  // Click a booking → join the meeting (falls back to the prospect record).
  const bookingHref = (id: string) => videoLink || `/admin/sales/${id}`;
  const external = !!videoLink;

  const byDay = new Map<string, { time: string; name: string; id: string }[]>();
  for (const d of demos) {
    const { ymd, hm } = londonParts(d.demo_at);
    const arr = byDay.get(ymd) ?? [];
    arr.push({ time: hm, name: d.name, id: d.id });
    byDay.set(ymd, arr);
  }

  // Build the month grid (Monday-first).
  const daysInMonth = new Date(yr, mo, 0).getDate();
  const firstWeekday = (new Date(yr, mo - 1, 1).getDay() + 6) % 7; // 0 = Monday
  const cells: ({ day: number; ymd: string } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, ymd: `${yr}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}` });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const todayYmd = londonParts(new Date().toISOString()).ymd;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/sales" className="text-sm text-white/70 hover:text-white">← Sales</Link>
          <h1 className="mt-1 text-2xl font-semibold text-white drop-shadow-sm">Demos</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/sales/demos?month=${prevM}`} className="grid h-8 w-8 place-items-center rounded-lg border border-white/40 bg-white/20 text-white hover:bg-white/30"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="min-w-[150px] text-center text-sm font-semibold text-white">{MONTHS[mo - 1]} {yr}</span>
          <Link href={`/admin/sales/demos?month=${nextM}`} className="grid h-8 w-8 place-items-center rounded-lg border border-white/40 bg-white/20 text-white hover:bg-white/30"><ChevronRight className="h-4 w-4" /></Link>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
          {WEEKDAYS.map((w) => <div key={w} className="px-2 py-2">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const items = cell ? byDay.get(cell.ymd) ?? [] : [];
            const isToday = cell?.ymd === todayYmd;
            return (
              <div key={i} className={`min-h-[92px] border-b border-r border-gray-100 p-1.5 ${!cell ? "bg-gray-50/50" : ""}`}>
                {cell && (
                  <>
                    <p className={`text-xs ${isToday ? "inline-grid h-5 w-5 place-items-center rounded-full bg-brand-600 font-semibold text-white" : "text-gray-400"}`}>{cell.day}</p>
                    <div className="mt-1 space-y-1">
                      {items.map((it, j) => (
                        <a key={j} href={bookingHref(it.id)} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="block truncate rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 hover:bg-brand-100" title={`${it.time} · ${it.name} — join the demo`}>
                          {it.time} {it.name}
                        </a>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming list */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Upcoming demos</h2>
        {(() => {
          const upcoming = demos.filter((d) => new Date(d.demo_at) >= new Date()).sort((a, b) => a.demo_at.localeCompare(b.demo_at));
          if (upcoming.length === 0) return <p className="mt-2 text-sm text-gray-500">No upcoming demos this month.</p>;
          return (
            <ul className="mt-2 divide-y divide-gray-100">
              {upcoming.map((d) => {
                const p = londonParts(d.demo_at);
                return (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                    <Link href={`/admin/sales/${d.id}`} className="font-medium text-gray-900 hover:text-brand-700 hover:underline">{d.name}</Link>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">{new Date(d.demo_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · {p.hm}</span>
                      {videoLink && (
                        <a href={videoLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
                          <Video className="h-3.5 w-3.5" /> Join
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          );
        })()}
      </div>
    </div>
  );
}
