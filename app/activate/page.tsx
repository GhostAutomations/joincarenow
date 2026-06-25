import { redirect } from "next/navigation";
import { requireCompany } from "@/modules/auth/queries";
import { parseConcession, describeConcession } from "@/lib/billing/concession";
import { ActivatePay } from "@/components/billing/activate-pay";

const PLAN_LABEL: Record<string, string> = {
  monthly: "Monthly — £55/month (£150 one-off set-up)",
  commit: "12-month plan — £55/month, no set-up fee",
  annual: "Annual — £550/year (2 months free), no set-up fee",
  diamond: "Diamond — free subscription & set-up; pay only for SMS & AI usage",
};

function isActive(status: string | null, comped: boolean): boolean {
  return comped || status === "active" || status === "trialing";
}

/** Pay-to-activate gate. A signed-up customer admin completes payment here
 *  before the dashboard unlocks. Outside the dashboard layout so it can't loop. */
export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireCompany({ allowSetup: true });
  const acting = "acting" in ctx && ctx.acting === true;
  if (acting || ctx.profile?.is_platform_admin) redirect("/dashboard");
  if (ctx.current.role !== "admin") redirect("/dashboard"); // managers can't pay; don't gate them here

  const { supabase, current } = ctx;
  const { status: qStatus } = await searchParams;

  const { data: company } = await supabase
    .from("companies")
    .select("name, agreed_plan, agreed_offer, billing_status, billing_comped")
    .eq("id", current.company_id)
    .single();

  if (isActive((company?.billing_status as string) ?? null, company?.billing_comped === true)) redirect("/dashboard");

  const plan = (company?.agreed_plan as string) ?? "monthly";
  const concession = describeConcession(parseConcession(company?.agreed_offer as string | null));
  const justPaid = qStatus === "success";

  return (
    <main className="min-h-screen jcn-app-bg">
      <header className="flex h-14 items-center border-b border-white/20 bg-white/10 px-6 backdrop-blur">
        <span className="text-base font-bold text-white drop-shadow-sm">Join Care Now</span>
      </header>
      <div className="mx-auto max-w-md px-6 py-12">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {justPaid ? (
            <>
              <h1 className="text-xl font-semibold text-gray-900">Finalising your account…</h1>
              <p className="mt-2 text-sm text-gray-600">
                Thanks — we&apos;re confirming your payment. This usually takes a few seconds.
              </p>
              <a href="/activate" className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                Continue
              </a>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-gray-900">Activate your subscription</h1>
              <p className="mt-2 text-sm text-gray-600">
                You&apos;re one step away. Complete payment to activate {company?.name ?? "your account"}.
              </p>
              <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm">
                <p className="font-medium text-gray-900">{PLAN_LABEL[plan] ?? "Join Care Now subscription"}</p>
                {concession && <p className="mt-1 text-green-700">Includes your agreed offer: {concession}</p>}
                <p className="mt-2 text-gray-500">Everything included — recruitment, onboarding and compliance, 1 branch and 100 SMS/month.</p>
              </div>
              {qStatus === "cancelled" && (
                <p className="mt-3 text-sm text-amber-700">Checkout was cancelled — you can try again whenever you&apos;re ready.</p>
              )}
              <div className="mt-5">
                <ActivatePay />
              </div>
              <p className="mt-3 text-xs text-gray-400">Secure payment by Stripe. You can manage or cancel from Billing later, subject to your plan&apos;s terms.</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
