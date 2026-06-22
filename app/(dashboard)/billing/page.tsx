import { CreditCard, Check, MessageSquareText, Sparkles, Building2, ShieldCheck, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireCompany } from "@/modules/auth/queries";
import { startCheckout, openBillingPortal } from "@/modules/billing/actions";
import { BranchBilling } from "@/components/dashboard/branch-billing";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";

const INCLUDED = [
  "Every feature — recruitment, onboarding & employee records",
  "Core compliance: Right to Work, DBS, references",
  "Branded careers page & applicant tracking",
  "Contracts & policies with e-signature",
  "1 branch and 100 SMS included each month",
];

const ADD_ONS = [
  ["Extra branch", "£7.50 / month each"],
  ["SMS", "100 included, then 8p each"],
  ["AI actions", "10p each"],
  ["Forms", "from the Form Store, per form"],
];

function monthStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export default async function BillingPage() {
  const { supabase, current } = await requireCompany();
  const isAdmin = current.role === "admin";

  const { data: company } = await supabase
    .from("companies")
    .select("billing_status, billing_interval, current_period_end, extra_branches")
    .eq("id", current.company_id)
    .single();

  const status = (company?.billing_status as string) ?? "none";
  const interval = company?.billing_interval as string | null;
  const periodEnd = company?.current_period_end as string | null;
  const active = status === "active" || status === "trialing";

  const { data: usage } = await supabase
    .from("usage_events")
    .select("kind, quantity")
    .eq("company_id", current.company_id)
    .gte("created_at", monthStartIso());
  const sms = (usage ?? []).filter((u) => u.kind === "sms").reduce((s, u) => s + (u.quantity ?? 0), 0);
  const ai = (usage ?? []).filter((u) => u.kind === "ai").reduce((s, u) => s + (u.quantity ?? 0), 0);
  const smsPct = Math.min(100, Math.round((sms / 100) * 100));

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("company_id", current.company_id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Billing" subtitle="Manage your subscription, payment method and invoices." />

      {active ? (
        <div className="mt-6 space-y-4">
          {/* Compact plan bar */}
          <div className="jcn-app-bg relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl px-5 py-3.5 text-white shadow-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-green-300" />
                {status === "trialing" ? "Trialing" : "Active"}
              </span>
              <span className="font-semibold">Join Care Now</span>
              <span className="text-white/90">{interval === "year" ? "£550 / year" : "£55 / month"}</span>
              {periodEnd && (
                <span className="inline-flex items-center gap-1 text-sm text-white/70">
                  <CalendarClock className="h-3.5 w-3.5" />
                  renews {new Date(periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
            </div>
            {isAdmin ? (
              <form action={openBillingPortal}>
                <button className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-white/90">
                  <CreditCard className="h-4 w-4" /> Manage billing
                </button>
              </form>
            ) : (
              <span className="text-sm text-white/80">Ask an admin to manage billing.</span>
            )}
          </div>

          {/* Usage stat cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm text-gray-500"><MessageSquareText className="h-4 w-4 text-brand-600" /> SMS sent</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{sms}<span className="text-sm font-normal text-gray-400"> / 100</span></p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${smsPct}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-gray-400">{sms > 100 ? `${sms - 100} over — 8p each` : "100 included, then 8p"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm text-gray-500"><Sparkles className="h-4 w-4 text-brand-600" /> AI actions</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{ai}</p>
              <p className="mt-1.5 text-xs text-gray-400">10p each</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm text-gray-500"><Building2 className="h-4 w-4 text-brand-600" /> Branches</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{1 + (company?.extra_branches ?? 0)}</p>
              <p className="mt-1.5 text-xs text-gray-400">1 included, then £7.50/mo</p>
            </div>
          </div>

          <CollapsibleSection title="Branches" count={branches?.length ?? 0} defaultOpen={false}>
            <BranchBilling branches={branches ?? []} companyId={current.company_id} canManage={isAdmin} />
          </CollapsibleSection>
        </div>
      ) : (
        /* Not subscribed — pricing card */
        <div className="mt-6">
          {status === "past_due" && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Your last payment failed. Please update your payment method to keep your account active.
            </div>
          )}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:grid md:grid-cols-5">
            {/* Price panel */}
            <div className="jcn-app-bg relative overflow-hidden p-8 text-white md:col-span-2">
              <div className="jcn-blob pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
              <p className="relative text-xs font-semibold uppercase tracking-wider text-white/80">Join Care Now</p>
              <p className="relative mt-3 flex items-baseline gap-1">
                <span className="text-5xl font-bold">£55</span>
                <span className="text-white/80">/ month</span>
              </p>
              <p className="relative mt-2 text-sm text-white/90">or <span className="font-semibold">£550 / year</span> — 2 months free</p>
              <p className="relative mt-4 text-sm text-white/75">
                £150 one-off setup on monthly — <span className="font-medium text-white">waived</span> on a 12-month term.
              </p>
              <p className="relative mt-6 inline-flex items-center gap-1.5 text-xs text-white/70">
                <CreditCard className="h-3.5 w-3.5" /> Secure payment by Stripe · cancel anytime
              </p>
            </div>
            {/* Features + CTAs */}
            <div className="p-8 md:col-span-3">
              <h2 className="text-lg font-semibold text-gray-900">One plan. Everything included.</h2>
              <ul className="mt-4 space-y-2.5">
                {INCLUDED.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {f}
                  </li>
                ))}
              </ul>
              {isAdmin ? (
                <div className="mt-6 flex flex-wrap gap-2.5">
                  <form action={startCheckout}>
                    <input type="hidden" name="interval" value="year" />
                    <button className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
                      Subscribe annually <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">2 months free</span>
                    </button>
                  </form>
                  <form action={startCheckout}>
                    <input type="hidden" name="interval" value="month" />
                    <button className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-50">
                      Subscribe monthly
                    </button>
                  </form>
                </div>
              ) : (
                <p className="mt-6 text-sm text-gray-500">Ask a company admin to set up billing.</p>
              )}
            </div>
          </div>

          {/* Add-ons */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pay only for what you use</p>
            <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
              {ADD_ONS.map(([label, price]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 border-b border-gray-50 pb-2 text-sm">
                  <span className="flex items-center gap-1.5 text-gray-700"><Check className="h-3.5 w-3.5 text-brand-600" /> {label}</span>
                  <span className="font-medium text-gray-900">{price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
