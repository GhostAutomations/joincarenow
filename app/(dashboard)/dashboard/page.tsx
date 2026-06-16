import Link from "next/link";
import {
  Briefcase, KanbanSquare, CalendarClock, Users, ClipboardCheck,
  IdCard, FileText, Store, MessageSquareText, BarChart3, Settings,
} from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { londonToUtcIso } from "@/lib/time";

const APPS = [
  { href: "/jobs", label: "Jobs", icon: Briefcase, grad: "from-teal-400 to-teal-600" },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare, grad: "from-indigo-400 to-indigo-600", badgeKey: "applicants" },
  { href: "/interviews", label: "Interviews", icon: CalendarClock, grad: "from-violet-400 to-violet-600", badgeKey: "interviews" },
  { href: "/applicants", label: "Applicants", icon: Users, grad: "from-sky-400 to-sky-600" },
  { href: "/onboarding-board", label: "Workflow", icon: ClipboardCheck, grad: "from-emerald-400 to-emerald-600", badgeKey: "workflow" },
  { href: "/employees", label: "Employees", icon: IdCard, grad: "from-cyan-400 to-cyan-600" },
  { href: "/forms", label: "Forms", icon: FileText, grad: "from-amber-400 to-amber-500" },
  { href: "/templates", label: "Templates", icon: MessageSquareText, grad: "from-pink-400 to-pink-600" },
  { href: "/store", label: "Form Store", icon: Store, grad: "from-rose-400 to-rose-600" },
  { href: "/reports", label: "Reports", icon: BarChart3, grad: "from-blue-400 to-blue-600" },
  { href: "/settings", label: "Settings", icon: Settings, grad: "from-slate-400 to-slate-600" },
] as const;

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
        <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-5 lg:grid-cols-6">
          {APPS.map(({ href, label, icon: Icon, grad, ...rest }) => {
            const badge = "badgeKey" in rest ? counts[(rest as { badgeKey: string }).badgeKey] : 0;
            return (
              <Link key={href} href={href} className="group flex flex-col items-center gap-2">
                <div className={`relative grid h-[68px] w-[68px] place-items-center rounded-[20px] bg-gradient-to-br ${grad} border border-white/30 shadow-lg transition-transform group-hover:-translate-y-1`}>
                  <Icon className="h-8 w-8 text-white" strokeWidth={1.8} />
                  {badge > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 grid h-[22px] min-w-[22px] place-items-center rounded-full border-2 border-teal-700 bg-rose-500 px-1 text-[11px] font-semibold text-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </div>
                <span className="text-[13px] font-medium text-white">{label}</span>
              </Link>
            );
          })}
        </div>

        <p className="mt-7 text-xs text-white/60">
          {jobs.count ?? 0} live job{(jobs.count ?? 0) === 1 ? "" : "s"} on your careers page.
        </p>
      </div>
    </div>
  );
}
