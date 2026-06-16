import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { FounderAppGrid } from "@/components/dashboard/founder-app-grid";

export default async function FounderHomePage() {
  const { supabase, profile } = await requirePlatformAdmin();

  const [{ count: companyCount }, { data: smsUsage }] = await Promise.all([
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.rpc("get_sms_usage"),
  ]);

  const smsThisMonth = (smsUsage ?? []).reduce(
    (sum: number, r: { sms_this_month: number }) => sum + Number(r.sms_this_month),
    0
  );

  const first = profile?.full_name?.split(" ")[0] ?? "there";
  const hour = Number(
    new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/London" })
  );
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="relative -mx-4 -mt-4 -mb-24 flex min-h-[calc(100dvh-3.5rem)] flex-col overflow-hidden p-6 text-white sm:-mx-6 sm:-mt-6 sm:p-10">
      {/* fluid colour blobs */}
      <div className="jcn-blob pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-teal-300/40 blur-3xl" />
      <div className="jcn-blob jcn-blob-2 pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 rounded-full bg-fuchsia-400/30 blur-3xl" />
      <div className="jcn-blob jcn-blob-3 pointer-events-none absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-indigo-400/40 blur-3xl" />

      <div className="relative">
        <h1 className="text-3xl font-semibold">{greeting}, {first} 👋</h1>
        <p className="mt-1 text-white/70">Founder console · manage every company on the platform.</p>

        {/* stat cards */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:max-w-md">
          <Link
            href="/admin/companies"
            className="rounded-2xl border border-white/25 bg-white/15 p-4 backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/25"
          >
            <p className="text-sm text-white/70">Companies</p>
            <p className="mt-1 text-3xl font-semibold">{companyCount ?? 0}</p>
          </Link>
          <Link
            href="/admin/sms"
            className="rounded-2xl border border-white/25 bg-white/15 p-4 backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/25"
          >
            <p className="flex items-center gap-1.5 text-sm text-white/70">
              <MessageSquare className="h-3.5 w-3.5" /> SMS this month
            </p>
            <p className="mt-1 text-3xl font-semibold">{smsThisMonth.toLocaleString()}</p>
          </Link>
        </div>

        {/* app grid */}
        <p className="mt-8 text-sm font-medium text-white/70">Your workspace</p>
        <FounderAppGrid />
      </div>
    </div>
  );
}
