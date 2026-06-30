import Link from "next/link";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { londonToUtcIso } from "@/lib/time";
import { FounderAppGrid } from "@/components/dashboard/founder-app-grid";

export default async function FounderHomePage() {
  const { profile } = await requirePlatformAdmin();
  const db = createAdminClient();

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const monthStart = londonToUtcIso(`${todayStr.slice(0, 7)}-01T00:00`);
  const todayStartUtc = londonToUtcIso(`${todayStr}T00:00`);
  const tomorrowStr = new Date(new Date(`${todayStr}T12:00:00Z`).getTime() + 86400e3).toISOString().slice(0, 10);
  const tomorrowStartUtc = londonToUtcIso(`${tomorrowStr}T00:00`);
  const nowIso = new Date().toISOString();
  const n = (r: { count: number | null }) => r.count ?? 0;
  const head = { count: "exact" as const, head: true };

  const [
    companies, hires, liveJobs, emails, sms, errors, syncErrors, newFeedback, newRequests, demosToday, upcomingDemos, formsPurchased,
  ] = await Promise.all([
    db.from("companies").select("id", head),
    db.from("employees").select("id", head),
    db.from("jobs").select("id", head).eq("status", "published"),
    db.from("messages").select("id", head).eq("channel", "email").eq("direction", "outbound").gte("created_at", monthStart),
    db.from("messages").select("id", head).eq("channel", "sms").eq("direction", "outbound").gte("created_at", monthStart),
    db.from("error_logs").select("id", head),
    db.from("integration_events").select("id", head).eq("status", "error"),
    db.from("feedback").select("id", head).is("response", null),
    db.from("feature_requests").select("id", head).eq("status", "new"),
    db.from("prospect_companies").select("id", head).not("demo_at", "is", null).gte("demo_at", todayStartUtc).lt("demo_at", tomorrowStartUtc),
    db.from("prospect_companies").select("id", head).not("demo_at", "is", null).gte("demo_at", nowIso),
    db.from("form_purchases").select("id", head),
  ]);

  const first = profile?.full_name?.split(" ")[0] ?? "there";
  const hour = Number(
    new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/London" })
  );
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const stats: { label: string; value: number | string; href?: string; alert?: boolean }[] = [
    { label: "Companies", value: n(companies), href: "/founder/companies" },
    { label: "Live jobs / Hires", value: `${n(liveJobs)} / ${n(hires)}` },
    { label: "Demos today", value: n(demosToday), href: "/founder/sales/demos" },
    { label: "Upcoming demos", value: n(upcomingDemos), href: "/founder/sales/demos" },
    { label: "Emails this month", value: n(emails) },
    { label: "SMS this month", value: n(sms), href: "/founder/sms" },
    { label: "Forms purchased", value: n(formsPurchased), href: "/founder/forms/sales" },
    { label: "New feedback", value: n(newFeedback), href: "/founder/feedback", alert: n(newFeedback) > 0 },
    { label: "Requests to quote", value: n(newRequests), href: "/founder/requests", alert: n(newRequests) > 0 },
    { label: "Errors", value: n(errors), href: "/founder/errors", alert: n(errors) > 0 },
    { label: "Sync errors", value: n(syncErrors), href: "/founder/integrations", alert: n(syncErrors) > 0 },
  ];

  return (
    <div className="relative -mx-4 -mt-4 -mb-24 flex min-h-[calc(100dvh-3.5rem)] flex-col overflow-hidden p-6 text-white sm:-mx-6 sm:-mt-6 sm:p-10">
      <div className="jcn-blob pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-teal-300/40 blur-3xl" />
      <div className="jcn-blob jcn-blob-2 pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 rounded-full bg-fuchsia-400/30 blur-3xl" />
      <div className="jcn-blob jcn-blob-3 pointer-events-none absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-indigo-400/40 blur-3xl" />

      <div className="relative">
        <h1 className="text-3xl font-semibold">{greeting}, {first} 👋</h1>
        <p className="mt-1 text-white/70">Founder console · the whole platform at a glance.</p>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => {
            const inner = (
              <>
                <p className="text-sm text-white/70">{s.label}</p>
                <p className={`mt-1 text-3xl font-semibold ${s.alert ? "text-amber-200" : ""}`}>
                  {s.value.toLocaleString()}
                </p>
              </>
            );
            const cls = `rounded-2xl border p-4 backdrop-blur-md ${
              s.alert ? "border-amber-300/60 bg-amber-400/15" : "border-white/25 bg-white/15"
            }`;
            return s.href ? (
              <Link key={s.label} href={s.href} className={`${cls} transition hover:-translate-y-0.5 hover:bg-white/25`}>
                {inner}
              </Link>
            ) : (
              <div key={s.label} className={cls}>{inner}</div>
            );
          })}
        </div>

        <p className="mt-8 text-sm font-medium text-white/70">Your workspace</p>
        <FounderAppGrid />
      </div>
    </div>
  );
}
