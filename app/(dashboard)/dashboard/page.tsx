import { requireCompany } from "@/modules/auth/queries";
import { londonToUtcIso } from "@/lib/time";
import { AppGrid } from "@/components/dashboard/app-grid";

export default async function DashboardPage() {
  const { supabase, current, profile } = await requireCompany();
  const cid = current.company_id;

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const dayStart = londonToUtcIso(`${todayStr}T00:00`);
  const dayEnd = new Date(new Date(dayStart).getTime() + 86_400_000).toISOString();
  const monthStart = londonToUtcIso(`${todayStr.slice(0, 7)}-01T00:00`);
  const count = (q: { count: number | null }) => q.count ?? 0;

  const [jobs, applicants, interviews, workflow, sms] = await Promise.all([
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("status", "published"),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("company_id", cid).in("stage", ["applied", "reviewing", "interview", "offer"]),
    supabase.from("interviews").select("id", { count: "exact", head: true }).eq("company_id", cid).gte("scheduled_at", dayStart).lt("scheduled_at", dayEnd),
    supabase.from("onboarding_tasks").select("id", { count: "exact", head: true }).eq("company_id", cid).neq("status", "approved"),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("channel", "sms").eq("direction", "outbound").gte("created_at", monthStart),
  ]);

  const counts: Record<string, number> = {
    applicants: count(applicants),
    interviews: count(interviews),
    workflow: count(workflow),
  };
  const first = profile?.full_name?.split(" ")[0] ?? "there";
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/London" }));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const stats = [
    { label: "Active applicants", value: count(applicants) },
    { label: "Interviews today", value: count(interviews) },
    { label: "In workflow", value: count(workflow) },
    { label: "SMS this month", value: count(sms) },
  ];

  return (
    <div className="relative -mx-4 -mt-4 -mb-24 flex min-h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-gradient-to-br from-teal-600 via-cyan-700 to-indigo-800 p-6 text-white sm:-mx-6 sm:-mt-6 sm:p-10">
      {/* fluid colour blobs */}
      <div className="jcn-blob pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-teal-300/40 blur-3xl" />
      <div className="jcn-blob jcn-blob-2 pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 rounded-full bg-fuchsia-400/30 blur-3xl" />
      <div className="jcn-blob jcn-blob-3 pointer-events-none absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-indigo-400/40 blur-3xl" />

      <div className="relative">
        <h1 className="text-3xl font-semibold">{greeting}, {first} 👋</h1>
        <p className="mt-1 text-white/70">{current.companies.name} · here&apos;s what&apos;s happening today.</p>

        {/* stat cards */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/25 bg-white/15 p-4 backdrop-blur-md">
              <p className="text-sm text-white/70">{s.label}</p>
              <p className="mt-1 text-3xl font-semibold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* app grid */}
        <p className="mt-8 text-sm font-medium text-white/70">Your workspace</p>
        <AppGrid counts={counts} />

        <p className="mt-7 text-xs text-white/60">
          {jobs.count ?? 0} live job{(jobs.count ?? 0) === 1 ? "" : "s"} on your careers page.
        </p>
      </div>
    </div>
  );
}
