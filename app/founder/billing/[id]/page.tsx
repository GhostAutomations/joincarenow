import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink, MessageSquareText, Sparkles, Building2, Bot, type LucideIcon } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { listInvoices } from "@/lib/billing/stripe";
import { FounderBillingControls } from "@/components/dashboard/founder-billing-controls";

/** A clickable usage stat card showing month/quarter/year-to-date figures. */
function UsageStatCard({
  href,
  icon: Icon,
  label,
  stats,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  stats: { mtd: number; qtd: number; ytd: number };
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-4 shadow-sm transition hover:bg-white/85"
    >
      <p className="flex items-center justify-between text-sm text-gray-500">
        <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-brand-600" /> {label}</span>
        <span className="text-[11px] font-medium text-brand-600 opacity-0 transition group-hover:opacity-100">Details →</span>
      </p>
      <div className="mt-2 grid grid-cols-3 gap-1 text-center">
        {([["MTD", stats.mtd], ["QTD", stats.qtd], ["YTD", stats.ytd]] as const).map(([k, v]) => (
          <div key={k}>
            <p className="text-xl font-bold text-gray-900">{v}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{k}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trialing: "bg-blue-100 text-blue-700",
  past_due: "bg-red-100 text-red-700",
  canceled: "bg-gray-200 text-gray-600",
  incomplete: "bg-amber-100 text-amber-700",
  none: "bg-gray-100 text-gray-500",
};

export default async function CompanyBillingPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const db = createAdminClient();

  const { data: company } = await db
    .from("companies")
    .select("id, name, billing_status, billing_interval, current_period_end, commitment_until, extra_branches, stripe_customer_id, stripe_subscription_id, billing_comped, created_at, plan_tier, agreed_plan, settings")
    .eq("id", id)
    .single();
  if (!company) notFound();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [{ data: usage }, { data: poppyCredits }, { data: branches }] = await Promise.all([
    db.from("usage_events").select("kind, quantity, created_at").eq("company_id", id).gte("created_at", yearStart.toISOString()),
    db.from("poppy_applicant_credits").select("consumed_at").eq("company_id", id).gte("consumed_at", yearStart.toISOString()),
    db.from("branches").select("id, name").eq("company_id", id).order("created_at", { ascending: true }),
  ]);
  const sumUsage = (kind: string, since: Date) =>
    (usage ?? [])
      .filter((u) => u.kind === kind && new Date(u.created_at as string) >= since)
      .reduce((s, u) => s + ((u.quantity as number) ?? 0), 0);
  const countPoppy = (since: Date) =>
    (poppyCredits ?? []).filter((c) => new Date(c.consumed_at as string) >= since).length;
  const smsStats = { mtd: sumUsage("sms", monthStart), qtd: sumUsage("sms", quarterStart), ytd: sumUsage("sms", yearStart) };
  const aiStats = { mtd: sumUsage("ai", monthStart), qtd: sumUsage("ai", quarterStart), ytd: sumUsage("ai", yearStart) };
  const poppyStats = { mtd: countPoppy(monthStart), qtd: countPoppy(quarterStart), ytd: countPoppy(yearStart) };

  const customerId = company.stripe_customer_id as string | null;
  const invoices = customerId ? await listInvoices(customerId) : [];

  const status = (company.billing_status as string) ?? "none";
  const comped = company.billing_comped === true;
  const interval = company.billing_interval as string | null;
  const committed = company.commitment_until && new Date(company.commitment_until as string) > new Date();
  const isPoppy = company.plan_tier === "poppy";
  const isDiamond = company.agreed_plan === "diamond";
  const poppyOfferPending =
    (company.settings as { poppy_offer?: { status?: string } } | null)?.poppy_offer?.status === "pending";
  const corePrice = interval === "year" ? "£490 / year" : committed ? "£49 / month · 12-month commitment" : "£49 / month";
  const poppyPrice = interval === "year" ? "£790 / year" : committed ? "£79 / month · 12-month commitment" : "£89 / month";
  const planLabel = comped
    ? "Complimentary"
    : status !== "active" && status !== "trialing"
    ? "—"
    : isDiamond
    ? `Usage only${isPoppy ? " · Poppy" : ""}`
    : isPoppy
    ? poppyPrice
    : corePrice;
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
  const money = (pence: number) => "£" + (pence / 100).toFixed(2);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/founder/billing" className="text-sm text-white/70 hover:text-white">← Billing</Link>
          <h1 className="mt-1 text-2xl font-semibold text-white drop-shadow-sm">{company.name}</h1>
        </div>
        {customerId && (
          <a href={`https://dashboard.stripe.com/test/customers/${customerId}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-white/30">
            Open in Stripe <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Subscription */}
      <div className="mt-5 rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${comped ? "bg-violet-100 text-violet-700" : STATUS_BADGE[status] ?? STATUS_BADGE.none}`}>
            {comped ? "Complimentary" : status === "none" ? "No subscription" : status.replace("_", " ")}
          </span>
          <span className="text-sm font-medium text-gray-900">{planLabel}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div><p className="text-gray-400">Renews</p><p className="font-medium text-gray-900">{date(company.current_period_end as string | null)}</p></div>
          <div><p className="text-gray-400">Commitment</p><p className="font-medium text-gray-900">{committed ? `until ${date(company.commitment_until as string)}` : interval === "year" ? "annual term" : "none"}</p></div>
          <div><p className="text-gray-400">Branches</p><p className="font-medium text-gray-900">{1 + ((company.extra_branches as number) ?? 0)}</p></div>
          <div><p className="text-gray-400">Customer since</p><p className="font-medium text-gray-900">{date(company.created_at as string)}</p></div>
        </div>
      </div>

      {/* Usage — MTD / QTD / YTD. Click SMS, AI or Poppy to see what it was used for. */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <UsageStatCard href={`/founder/billing/${id}/usage?kind=sms`} icon={MessageSquareText} label="SMS" stats={smsStats} />
        <UsageStatCard href={`/founder/billing/${id}/usage?kind=ai`} icon={Sparkles} label="AI" stats={aiStats} />
        <UsageStatCard href={`/founder/billing/${id}/usage?kind=poppy`} icon={Bot} label="Poppy" stats={poppyStats} />
        <div className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-4 shadow-sm">
          <p className="flex items-center gap-2 text-sm text-gray-500"><Building2 className="h-4 w-4 text-brand-600" /> Branches</p>
          <p className="mt-2 text-xl font-bold text-gray-900">{1 + ((company.extra_branches as number) ?? 0)}</p>
        </div>
      </div>

      {/* Invoices */}
      <div className="mt-4 rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No invoices yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {inv.number || inv.id}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${inv.status === "paid" ? "bg-green-100 text-green-700" : inv.status === "open" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>{inv.status ?? "—"}</span>
                  </p>
                  <p className="text-xs text-gray-500">{date(new Date(inv.created * 1000).toISOString())} · {money(inv.total)}</p>
                </div>
                {inv.invoice_pdf && (
                  <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white/60">
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Founder controls */}
      <div className="mt-4">
        <FounderBillingControls
          companyId={company.id as string}
          comped={comped}
          hasSubscription={Boolean(company.stripe_subscription_id)}
          poppy={isPoppy}
          offerPending={poppyOfferPending}
        />
      </div>
    </div>
  );
}
