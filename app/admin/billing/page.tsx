import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

type Row = {
  id: string;
  name: string;
  billing_status: string | null;
  billing_interval: string | null;
  current_period_end: string | null;
  commitment_until: string | null;
  extra_branches: number | null;
  stripe_customer_id: string | null;
  created_at: string;
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trialing: "bg-blue-100 text-blue-700",
  past_due: "bg-red-100 text-red-700",
  canceled: "bg-gray-200 text-gray-600",
  incomplete: "bg-amber-100 text-amber-700",
  none: "bg-gray-100 text-gray-500",
};

function monthStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export default async function AdminBillingPage() {
  await requirePlatformAdmin();
  const db = createAdminClient();

  const [{ data: companies }, { data: usage }] = await Promise.all([
    db.from("companies")
      .select("id, name, billing_status, billing_interval, current_period_end, commitment_until, extra_branches, stripe_customer_id, created_at")
      .order("name"),
    db.from("usage_events").select("company_id, kind, quantity").gte("created_at", monthStartIso()),
  ]);
  const rows = (companies ?? []) as Row[];

  // Usage by company this month.
  const usageMap = new Map<string, { sms: number; ai: number }>();
  for (const u of usage ?? []) {
    const cur = usageMap.get(u.company_id as string) ?? { sms: 0, ai: 0 };
    if (u.kind === "sms") cur.sms += (u.quantity as number) ?? 0;
    if (u.kind === "ai") cur.ai += (u.quantity as number) ?? 0;
    usageMap.set(u.company_id as string, cur);
  }

  const isPaying = (r: Row) => r.billing_status === "active" || r.billing_status === "trialing";
  const now = new Date();
  const committed = (r: Row) => r.commitment_until && new Date(r.commitment_until) > now;

  // MRR = base + extra branches (monthly equivalent). Usage excluded (variable).
  const mrr = rows.reduce((s, r) => {
    if (!isPaying(r)) return s;
    const base = r.billing_interval === "year" ? 550 / 12 : 55;
    const branches = (r.extra_branches ?? 0) * 7.5;
    return s + base + branches;
  }, 0);
  const paying = rows.filter(isPaying).length;
  const onCommitment = rows.filter((r) => isPaying(r) && committed(r)).length;
  const pastDue = rows.filter((r) => r.billing_status === "past_due").length;

  const money = (n: number) => "£" + Math.round(n).toLocaleString();
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

  const metrics = [
    { label: "MRR", value: money(mrr) },
    { label: "ARR", value: money(mrr * 12) },
    { label: "Paying", value: paying.toString() },
    { label: "On commitment", value: onCommitment.toString() },
    { label: "Past due", value: pastDue.toString() },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Billing</h1>
      <p className="mt-1 text-sm text-white/80">Subscriptions and revenue across all companies.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-2xl border border-white/25 bg-white/15 p-3 backdrop-blur-md">
            <p className="text-xs text-white/70">{m.label}</p>
            <p className="mt-0.5 text-2xl font-semibold text-white">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Renews / commitment</th>
              <th className="px-4 py-3 text-right">Branches</th>
              <th className="px-4 py-3 text-right">SMS / AI (mo)</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((c) => {
              const status = c.billing_status ?? "none";
              const u = usageMap.get(c.id) ?? { sms: 0, ai: 0 };
              const planLabel = !isPaying(c)
                ? "—"
                : c.billing_interval === "year"
                ? "£550 / yr"
                : committed(c)
                ? "£55 / mo · 12-mo"
                : "£55 / mo";
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[status] ?? STATUS_BADGE.none}`}>
                      {status === "none" ? "No subscription" : status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{planLabel}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {date(c.current_period_end)}
                    {committed(c) && <span className="block text-xs text-brand-700">committed to {date(c.commitment_until)}</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{1 + (c.extra_branches ?? 0)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{u.sms} / {u.ai}</td>
                  <td className="px-4 py-3 text-right">
                    {c.stripe_customer_id && (
                      <a
                        href={`https://dashboard.stripe.com/test/customers/${c.stripe_customer_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-brand-700 hover:underline"
                      >
                        Stripe ↗
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">No companies yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-white/60">
        MRR includes base plan + extra branches (annual shown as monthly equivalent); variable SMS/AI usage isn&apos;t included.
        Stripe links point to test mode — switch the URL to live when you go live.
      </p>
    </div>
  );
}
