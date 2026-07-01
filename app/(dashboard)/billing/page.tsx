import { redirect } from "next/navigation";
import { CreditCard, Check, MessageSquareText, Sparkles, Building2, ShieldCheck, CalendarClock, Download } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireCompany } from "@/modules/auth/queries";
import { startCheckout, openBillingPortal, upgradeToPoppy } from "@/modules/billing/actions";
import { BranchBilling } from "@/components/dashboard/branch-billing";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import { PoppyUpgradeButton } from "@/components/dashboard/poppy-upgrade-button";
import { listInvoices } from "@/lib/billing/stripe";
import { poppyAllowanceUsed } from "@/lib/billing/poppy-credits";

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
  const { supabase, current } = await requireCompany({ allowSetup: true });
  // Billing is admin-only — operational roles can't see or manage it.
  if (current.role !== "admin") redirect("/dashboard");
  const isAdmin = true;

  const { data: company } = await supabase
    .from("companies")
    .select("billing_status, billing_interval, current_period_end, extra_branches, stripe_customer_id, commitment_until, billing_comped, sms_bonus, agreed_plan, plan_tier")
    .eq("id", current.company_id)
    .single();

  const status = (company?.billing_status as string) ?? "none";
  const interval = company?.billing_interval as string | null;
  const diamond = company?.agreed_plan === "diamond";
  const isPoppy = company?.plan_tier === "poppy";
  const poppyUsage = isPoppy ? await poppyAllowanceUsed(current.company_id) : null;
  const periodEnd = company?.current_period_end as string | null;
  const comped = company?.billing_comped === true;
  const active = status === "active" || status === "trialing" || comped;
  const commitmentUntil = company?.commitment_until as string | null;
  const committed = commitmentUntil ? new Date(commitmentUntil) > new Date() : false;
  const basePriceLabel = comped
    ? "Complimentary access"
    : diamond
      ? "Usage only — no subscription fee"
      : isPoppy
        ? interval === "year"
          ? "£790 / year"
          : committed
            ? "£79 / month"
            : "£89 / month"
        : interval === "year"
          ? "£490 / year"
          : "£49 / month";

  const { data: usage } = await supabase
    .from("usage_events")
    .select("kind, quantity")
    .eq("company_id", current.company_id)
    .gte("created_at", monthStartIso());
  const sms = (usage ?? []).filter((u) => u.kind === "sms").reduce((s, u) => s + (u.quantity ?? 0), 0);
  const ai = (usage ?? []).filter((u) => u.kind === "ai").reduce((s, u) => s + (u.quantity ?? 0), 0);
  const smsAllowance = 100 + ((company?.sms_bonus as number) ?? 0);
  const smsPct = Math.min(100, Math.round((sms / smsAllowance) * 100));

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("company_id", current.company_id)
    .eq("kind", "branch") // exclude the free Office Team target
    .order("created_at", { ascending: true });

  const customerId = company?.stripe_customer_id as string | null;
  const invoices = active && customerId ? await listInvoices(customerId) : [];
  const { data: agreementRow } = await supabase
    .from("company_agreements").select("agreed_at, signer_name").eq("company_id", current.company_id)
    .order("agreed_at", { ascending: false }).limit(1).maybeSingle();
  const money = (pence: number) => "£" + (pence / 100).toFixed(2);

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
                {comped ? "Complimentary" : diamond ? "Diamond" : status === "trialing" ? "Trialing" : "Active"}
              </span>
              <span className="font-semibold">Join Care Now{isPoppy ? " + Poppy" : ""}</span>
              <span className="text-white/90">{basePriceLabel}</span>
              {!comped && periodEnd && (
                <span className="inline-flex items-center gap-1 text-sm text-white/70">
                  <CalendarClock className="h-3.5 w-3.5" />
                  renews {new Date(periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
              {committed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium backdrop-blur">
                  12‑month commitment · until {new Date(commitmentUntil!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
              {!committed && interval === "year" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium backdrop-blur">
                  Annual term · no cancellation until renewal
                </span>
              )}
            </div>
            {comped ? (
              <span className="text-sm text-white/80">Provided by Join Care Now</span>
            ) : isAdmin ? (
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
            <div className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm text-gray-500"><MessageSquareText className="h-4 w-4 text-brand-600" /> SMS sent</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{sms}<span className="text-sm font-normal text-gray-400"> / {smsAllowance}</span></p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${smsPct}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-gray-400">{sms > smsAllowance ? `${sms - smsAllowance} over — 8p each` : `${smsAllowance} included, then 8p`}</p>
            </div>
            <div className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm text-gray-500"><Sparkles className="h-4 w-4 text-brand-600" /> AI actions</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{ai}</p>
              <p className="mt-1.5 text-xs text-gray-400">10p each</p>
            </div>
            <div className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm text-gray-500"><Building2 className="h-4 w-4 text-brand-600" /> Branches</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{1 + (company?.extra_branches ?? 0)}</p>
              <p className="mt-1.5 text-xs text-gray-400">{diamond ? "unlimited — free on Diamond" : "1 included, then £7.50/mo"}</p>
            </div>
            {isPoppy && poppyUsage && (
              <div className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-4 shadow-sm">
                <p className="flex items-center gap-2 text-sm text-gray-500"><Sparkles className="h-4 w-4 text-brand-600" /> Poppy screens</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">
                  {poppyUsage.used}<span className="text-sm font-normal text-gray-400"> / {poppyUsage.included}</span>
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, Math.round((poppyUsage.used / poppyUsage.included) * 100))}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-gray-400">
                  {poppyUsage.used > poppyUsage.included ? `${poppyUsage.used - poppyUsage.included} over — 75p each` : `${poppyUsage.included} included/month, then 75p`}
                </p>
              </div>
            )}
          </div>

          {!isPoppy && !diamond && !comped && isAdmin && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 shadow-sm">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">Add Poppy — your AI recruitment assistant</p>
                  <p className="text-xs text-gray-600">Screens applicants for you: reviews forms &amp; CV, asks follow-ups, writes a recommendation. 40 applicants/month included, then 75p each.</p>
                </div>
              </div>
              <PoppyUpgradeButton />
            </div>
          )}

          <CollapsibleSection title="Branches" count={branches?.length ?? 0} defaultOpen={false}>
            <BranchBilling
              branches={branches ?? []}
              companyId={current.company_id}
              canManage={isAdmin}
              rate={diamond ? 0 : interval === "year" ? 90 : 7.5}
              period={interval === "year" ? "year" : "month"}
              free={diamond}
            />
          </CollapsibleSection>

          <CollapsibleSection title="Invoices" count={invoices.length} defaultOpen={false}>
            {invoices.length === 0 ? (
              <p className="px-1 py-2 text-sm text-gray-500">No invoices yet — they appear here once your first one is issued.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-1 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {inv.number || inv.id}
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${inv.status === "paid" ? "bg-green-100 text-green-700" : inv.status === "open" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                          {inv.status ?? "—"}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(inv.created * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {money(inv.total)}
                      </p>
                    </div>
                    {inv.invoice_pdf && (
                      <a
                        href={inv.invoice_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white/60"
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
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
          <div className="overflow-hidden rounded-3xl border border-white/40 bg-white/70 backdrop-blur-md shadow-sm md:grid md:grid-cols-5">
            {/* Price panel */}
            <div className="jcn-app-bg relative overflow-hidden p-8 text-white md:col-span-2">
              <div className="jcn-blob pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
              <p className="relative text-xs font-semibold uppercase tracking-wider text-white/80">Join Care Now</p>
              <p className="relative mt-3 flex items-baseline gap-1">
                <span className="text-5xl font-bold">£49</span>
                <span className="text-white/80">/ month</span>
              </p>
              <p className="relative mt-2 text-sm text-white/90">or <span className="font-semibold">£490 / year</span> — 2 months free</p>
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
                <div className="mt-6 space-y-2.5">
                  <div className="flex flex-wrap gap-2.5">
                    <form action={startCheckout}>
                      <input type="hidden" name="tier" value="core" />
                      <input type="hidden" name="interval" value="year" />
                      <button className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
                        Subscribe annually <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">2 months free</span>
                      </button>
                    </form>
                    <form action={startCheckout}>
                      <input type="hidden" name="tier" value="core" />
                      <input type="hidden" name="interval" value="month" />
                      <button className="rounded-xl border border-white/40 bg-white/60 px-5 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-white/60">
                        Subscribe monthly
                      </button>
                    </form>
                  </div>
                  <form action={startCheckout} className="rounded-xl border border-brand-200 bg-brand-50 p-3">
                    <input type="hidden" name="tier" value="core" />
                    <input type="hidden" name="interval" value="month" />
                    <input type="hidden" name="commit" value="true" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold text-gray-900">£49/month, 12‑month commitment</span> — no £150 setup fee. Can&apos;t be cancelled before the term ends.
                      </p>
                      <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
                        Commit to 12 months
                      </button>
                    </div>
                  </form>

                  {/* Tier 2 — add Poppy */}
                  <div className="rounded-xl border border-brand-300 bg-white/70 p-3.5 shadow-sm">
                    <div className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">Add Poppy — AI recruitment assistant</p>
                        <p className="mt-0.5 text-xs text-gray-600">
                          Everything above plus Poppy: automated applicant screening with a written recommendation. 40 applicants/month included, then 75p each.
                          <span className="font-medium text-gray-900"> £89/mo</span> · <span className="font-medium text-gray-900">£790/yr</span> · <span className="font-medium text-gray-900">£79/mo</span> on a 12‑month term.
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          <form action={startCheckout}>
                            <input type="hidden" name="tier" value="poppy" />
                            <input type="hidden" name="interval" value="year" />
                            <button className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
                              Poppy annually <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">2 months free</span>
                            </button>
                          </form>
                          <form action={startCheckout}>
                            <input type="hidden" name="tier" value="poppy" />
                            <input type="hidden" name="interval" value="month" />
                            <button className="rounded-lg border border-white/40 bg-white/60 px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-white/60">
                              Poppy monthly
                            </button>
                          </form>
                          <form action={startCheckout}>
                            <input type="hidden" name="tier" value="poppy" />
                            <input type="hidden" name="interval" value="month" />
                            <input type="hidden" name="commit" value="true" />
                            <button className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50">
                              Poppy, 12‑month
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-6 text-sm text-gray-500">Ask a company admin to set up billing.</p>
              )}
            </div>
          </div>

          {/* Add-ons */}
          <div className="mt-4 rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-6 shadow-sm">
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

      {agreementRow && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-4 shadow-sm">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">Your subscription agreement</p>
            <p className="text-xs text-gray-500">
              Signed {new Date(agreementRow.agreed_at as string).toLocaleDateString("en-GB")} by {agreementRow.signer_name as string}
            </p>
          </div>
          <a
            href="/api/agreement/pdf"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white/60"
          >
            <Download className="h-3.5 w-3.5" /> Download PDF
          </a>
        </div>
      )}
    </div>
  );
}
