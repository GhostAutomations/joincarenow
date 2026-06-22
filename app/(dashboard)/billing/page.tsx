import { CreditCard, Check } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireCompany } from "@/modules/auth/queries";
import { startCheckout, openBillingPortal } from "@/modules/billing/actions";
import { BranchBilling } from "@/components/dashboard/branch-billing";

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

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("company_id", current.company_id)
    .order("name");

  return (
    <div>
      <PageHeader title="Billing" subtitle="Manage your subscription, payment method and invoices." />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Plan / status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          {active ? (
            <>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                  {status === "trialing" ? "Trialing" : "Active"}
                </span>
                <span className="text-sm text-gray-600">
                  Join Care Now — {interval === "year" ? "£550 / year" : "£55 / month"}
                </span>
              </div>
              {periodEnd && (
                <p className="mt-2 text-sm text-gray-500">
                  Renews {new Date(periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
                </p>
              )}
              {isAdmin ? (
                <form action={openBillingPortal} className="mt-4">
                  <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    Manage billing
                  </button>
                </form>
              ) : (
                <p className="mt-4 text-sm text-gray-500">Ask a company admin to manage billing.</p>
              )}
            </>
          ) : (
            <>
              {status === "past_due" && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  Your last payment failed. Please update your payment method to keep your account active.
                </div>
              )}
              <h2 className="text-lg font-semibold text-gray-900">One plan. Everything included.</h2>
              <p className="mt-1 text-sm text-gray-600">
                Every feature, 1 branch and 100 SMS/month. Core compliance (Right to Work, DBS,
                references) is always included.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">£55</span>
                  <span className="text-gray-500">/ month</span>
                </p>
                <span className="text-sm text-gray-400">or</span>
                <p className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">£550</span>
                  <span className="text-gray-500">/ year</span>
                </p>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                £150 one-off setup on monthly — waived when you commit to a 12-month term.
              </p>
              {isAdmin ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={startCheckout}>
                    <input type="hidden" name="interval" value="month" />
                    <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50">
                      Subscribe monthly
                    </button>
                  </form>
                  <form action={startCheckout}>
                    <input type="hidden" name="interval" value="year" />
                    <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                      Subscribe annually (2 months free)
                    </button>
                  </form>
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500">Ask a company admin to set up billing.</p>
              )}
            </>
          )}
        </div>

        {/* Usage + add-ons */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">This month</p>
            <div className="mt-2 space-y-1.5 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span>SMS sent</span>
                <span className="font-medium">{sms} <span className="text-gray-400">/ 100 incl.</span></span>
              </div>
              <div className="flex items-center justify-between">
                <span>AI actions</span>
                <span className="font-medium">{ai}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Branches</span>
                <span className="font-medium">{1 + (company?.extra_branches ?? 0)}</span>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pay only for what you use</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {ADD_ONS.map(([label, price]) => (
                <li key={label} className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-gray-700"><Check className="mt-0.5 h-3.5 w-3.5 text-brand-600" />{label}</span>
                  <span className="text-right font-medium text-gray-900">{price}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <BranchBilling branches={branches ?? []} companyId={current.company_id} canManage={isAdmin} />
      </div>

      {status === "none" && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
          <CreditCard className="h-3.5 w-3.5" /> Secure payment by Stripe. Cancel anytime.
        </p>
      )}
    </div>
  );
}
