import Link from "next/link";
import { CalendarClock, User } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { formatLondon } from "@/lib/time";

type Row = {
  interview_id: string;
  application_id: string;
  scheduled_at: string;
  duration_minutes: number;
  mode: string | null;
  location: string | null;
  status: string;
  applicant_name: string | null;
  interviewer_name: string | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  proposed: { label: "Awaiting reply", cls: "bg-blue-100 text-blue-800" },
  confirmed: { label: "Confirmed", cls: "bg-green-100 text-green-800" },
  reschedule_requested: { label: "New time requested", cls: "bg-amber-100 text-amber-800" },
  declined: { label: "Declined", cls: "bg-red-100 text-red-800" },
};

function modeLabel(m: string | null) {
  return m === "phone" ? "Phone" : m === "video" ? "Video" : m === "in_person" ? "In person" : "";
}

export default async function InterviewsPage() {
  const { supabase } = await requireCompany();
  const { data } = await supabase.rpc("get_company_interviews");
  const rows = (data ?? []) as Row[];

  // Upcoming first; group by London date.
  const now = Date.now();
  const upcoming = rows.filter((r) => new Date(r.scheduled_at).getTime() >= now - 12 * 3600_000);

  const byDay = new Map<string, Row[]>();
  for (const r of upcoming) {
    const key = formatLondon(r.scheduled_at, { weekday: "long", day: "numeric", month: "long" });
    (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(r);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Interviews</h1>
      <p className="mt-1 text-sm text-gray-500">
        Everyone&apos;s upcoming interviews. Visible to the whole team so you can see who&apos;s coming in and who they&apos;re meeting.
      </p>

      {upcoming.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No upcoming interviews scheduled.</p>
      ) : (
        <div className="mt-6 space-y-6">
          {[...byDay.entries()].map(([day, items]) => (
            <section key={day}>
              <h2 className="text-sm font-semibold text-gray-700">{day}</h2>
              <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <ul className="divide-y divide-gray-100">
                  {items.map((r) => (
                    <li key={r.interview_id} className="flex items-center gap-4 p-4">
                      <div className="w-16 shrink-0 text-sm font-semibold text-gray-900">
                        {formatLondon(r.scheduled_at, { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {r.applicant_name || "Applicant"}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3" /> {r.interviewer_name || "Unassigned"}
                          </span>
                          <span>· {r.duration_minutes} min</span>
                          {modeLabel(r.mode) && <span>· {modeLabel(r.mode)}</span>}
                          {r.location && <span>· {r.location}</span>}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[r.status]?.cls ?? "bg-gray-100 text-gray-700"}`}>
                        {STATUS[r.status]?.label ?? r.status}
                      </span>
                      <Link
                        href={`/pipeline?open=${r.application_id}`}
                        className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
