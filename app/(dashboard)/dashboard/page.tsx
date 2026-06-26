import Link from "next/link";
import { requireCompany } from "@/modules/auth/queries";
import { londonToUtcIso } from "@/lib/time";
import { AppGrid } from "@/components/dashboard/app-grid";
import { SignoffLive } from "@/components/dashboard/signoff-live";
import { GettingStartedChecklist, type ChecklistItem } from "@/components/dashboard/getting-started-checklist";
import { feedbackOpen } from "@/lib/feedback";

export default async function DashboardPage() {
  const { supabase, current, profile, user } = await requireCompany();
  const cid = current.company_id;

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const dayStart = londonToUtcIso(`${todayStr}T00:00`);
  const dayEnd = new Date(new Date(dayStart).getTime() + 86_400_000).toISOString();
  const monthStart = londonToUtcIso(`${todayStr.slice(0, 7)}-01T00:00`);
  const count = (q: { count: number | null }) => q.count ?? 0;

  const [jobs, applicants, interviews, workflow, signoff, sms, unreadMsgs] = await Promise.all([
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("status", "published"),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("company_id", cid).in("stage", ["applied", "reviewing", "interview", "offer"]),
    supabase.from("interviews").select("id", { count: "exact", head: true }).eq("company_id", cid).gte("scheduled_at", dayStart).lt("scheduled_at", dayEnd),
    supabase.from("onboarding_tasks").select("id", { count: "exact", head: true }).eq("company_id", cid).neq("status", "approved"),
    supabase.from("signed_documents").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("review_status", "pending"),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("channel", "sms").eq("direction", "outbound").gte("created_at", monthStart),
    supabase.from("staff_messages").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("recipient_id", user.id).is("read_at", null),
  ]);

  const counts: Record<string, number> = {
    applicants: count(applicants),
    interviews: count(interviews),
    workflow: count(workflow),
  };

  const { data: companyRow } = await supabase
    .from("companies").select("created_at, settings").eq("id", cid).single();
  const fbOpen = feedbackOpen(companyRow?.created_at as string | undefined);
  const isAdmin = current.role === "admin";

  // Admin-only "getting started" checklist — reflects the pre-loaded starter
  // pack and what's left to make the account their own. Hidden once complete.
  let checklist: ChecklistItem[] = [];
  if (isAdmin) {
    const [formsCount, onbCount, tplCount, branchCount, teamCount] = await Promise.all([
      supabase.from("forms").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("is_store", false),
      supabase.from("onboarding_templates").select("id", { count: "exact", head: true }).eq("company_id", cid),
      supabase.from("message_templates").select("id", { count: "exact", head: true }).eq("company_id", cid),
      supabase.from("branches").select("id", { count: "exact", head: true }).eq("company_id", cid),
      supabase.from("company_users").select("id", { count: "exact", head: true }).eq("company_id", cid),
    ]);
    const brand = (companyRow?.settings as { brand?: { logo_url?: string | null } } | null)?.brand;
    checklist = [
      { label: "Add your logo and brand colours", hint: "Make the platform and emails look like yours.", href: "/settings", done: Boolean(brand?.logo_url) },
      { label: "Set up your branches", hint: "Add the branches/locations you recruit for.", href: "/settings", done: count(branchCount) > 0 },
      { label: "Review your application form", hint: "A Care Worker Application is ready — tailor it to your roles.", href: "/forms", done: count(formsCount) > 0 },
      { label: "Review your onboarding workflow", hint: "Steps are set up — adjust them to your process.", href: "/onboarding-board", done: count(onbCount) > 0 },
      { label: "Review your message templates", hint: "Branded email + SMS for every stage are ready to use.", href: "/templates", done: count(tplCount) > 0 },
      { label: "Invite your team", hint: "Add managers and recruiters to your company.", href: "/settings", done: count(teamCount) > 1 },
    ];
  }

  const first = profile?.full_name?.split(" ")[0] ?? "there";
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/London" }));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const stats = [
    { label: "Live jobs", value: count(jobs), href: "/jobs" },
    { label: "Active applicants", value: count(applicants), href: "/pipeline" },
    { label: "Interviews today", value: count(interviews), href: "/interviews" },
    { label: "Sign Off", value: count(signoff), href: "/sign-off" },
    { label: "Messages", value: count(unreadMsgs), href: "/messages" },
    { label: "SMS this month", value: count(sms), href: "/templates" },
  ];

  return (
    <div className="relative -mx-4 -mt-4 -mb-24 flex min-h-[calc(100dvh-3.5rem)] flex-col overflow-hidden jcn-app-bg p-6 text-white sm:-mx-6 sm:-mt-6 sm:p-10">
      {/* fluid colour blobs */}
      <div className="jcn-blob pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-teal-300/40 blur-3xl" />
      <div className="jcn-blob jcn-blob-2 pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 rounded-full bg-fuchsia-400/30 blur-3xl" />
      <div className="jcn-blob jcn-blob-3 pointer-events-none absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-indigo-400/40 blur-3xl" />

      <SignoffLive />
      <div className="relative">
        <h1 className="text-3xl font-semibold">{greeting}, {first} 👋</h1>
        <p className="mt-1 text-white/70">{current.companies.name} · here&apos;s what&apos;s happening today.</p>

        {/* stat cards */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-2xl border border-white/25 bg-white/15 p-4 backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/25"
            >
              <p className="text-sm text-white/70">{s.label}</p>
              <p className="mt-1 text-3xl font-semibold">{s.value}</p>
            </Link>
          ))}
        </div>

        {/* getting-started checklist (admins, until complete) */}
        {isAdmin && <GettingStartedChecklist items={checklist} />}

        {/* app grid */}
        <p className="mt-8 text-sm font-medium text-white/70">Your workspace</p>
        <AppGrid counts={counts} feedbackOpen={fbOpen} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
