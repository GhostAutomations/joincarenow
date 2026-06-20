import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { londonToUtcIso } from "@/lib/time";

export default async function AdminStatisticsPage() {
  await requirePlatformAdmin();
  const db = createAdminClient();

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const monthStart = londonToUtcIso(`${todayStr.slice(0, 7)}-01T00:00`);
  const head = { count: "exact" as const, head: true };
  const n = (r: { count: number | null }) => r.count ?? 0;

  const [companies, applicants, active, interviews, offers, hires, liveJobs, emails, sms] = await Promise.all([
    db.from("companies").select("id", head),
    db.from("applicants").select("id", head),
    db.from("applications").select("id", head).in("stage", ["applied", "reviewing", "interview", "right_to_work", "offer"]),
    db.from("applications").select("id", head).eq("stage", "interview"),
    db.from("applications").select("id", head).eq("stage", "offer"),
    db.from("employees").select("id", head),
    db.from("jobs").select("id", head).eq("status", "published"),
    db.from("messages").select("id", head).eq("channel", "email").eq("direction", "outbound").gte("created_at", monthStart),
    db.from("messages").select("id", head).eq("channel", "sms").eq("direction", "outbound").gte("created_at", monthStart),
  ]);

  const stats = [
    { label: "Companies", value: n(companies) },
    { label: "Applicants (all time)", value: n(applicants) },
    { label: "Active applicants", value: n(active) },
    { label: "At interview", value: n(interviews) },
    { label: "At offer", value: n(offers) },
    { label: "Hires", value: n(hires) },
    { label: "Live jobs", value: n(liveJobs) },
    { label: "Emails this month", value: n(emails) },
    { label: "SMS this month", value: n(sms) },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Statistics</h1>
      <p className="mt-1 text-sm text-white/80">Platform-wide numbers across every company.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/25 bg-white/15 p-4 backdrop-blur-md">
            <p className="text-sm text-white/70">{s.label}</p>
            <p className="mt-1 text-3xl font-semibold">{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
